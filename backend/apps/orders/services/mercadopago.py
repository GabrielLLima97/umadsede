import mercadopago
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from ..models import Pedido, Pagamento, PedidoItem, Item
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)

def criar_preferencia(pedido_id: int):
    pedido = Pedido.objects.get(pk=pedido_id)
    items = [{
        "title": f"{pedido.id} - Hamburgueria UMADSEDE",
        "quantity": 1,
        "currency_id": "BRL",
        "unit_price": float(pedido.valor_total),
    }]
    back = {
        # Após finalizar no Mercado Pago, volta para a página do cliente
        "success": f"{settings.FRONT_URL}/cliente?pedido={pedido.id}",
        "pending": f"{settings.FRONT_URL}/cliente?pedido={pedido.id}",
        "failure": f"{settings.FRONT_URL}/cliente?pedido={pedido.id}",
    }
    pref = {
        "items": items,
        "external_reference": str(pedido.id),
        "back_urls": back,
        # auto_return removido para evitar erro invalid_auto_return
        "statement_descriptor": "UMADSEDE",
        # sem restringir Pix; apenas removemos ATM e cripto.
        "payment_methods": {
            "excluded_payment_types": [{"id":"atm"}, {"id":"digital_currency"}],
        },
        # URL pública para receber webhook (configure BACKEND_URL no .env)
        "notification_url": f"{settings.BACKEND_URL}/api/payments/webhook",
    }
    resp = sdk.preference().create(pref)
    if resp["status"] not in (200, 201):
        raise RuntimeError(resp)
    data = resp["response"]
    pag, _ = Pagamento.objects.update_or_create(
        pedido=pedido,
        defaults={
            "preference_id": data["id"],
            "status": "pending",
            "init_point": data.get("init_point") or data.get("sandbox_init_point") or "",
            "raw": data,
        },
    )
    pedido.payment_link = pag.init_point
    pedido.save()
    return {"preference_id": data["id"], "init_point": pedido.payment_link}

def _is_paid_merchant_order(mo: dict) -> bool:
    # Considera pago se payments contiver algum approved ou status geral pago/closed
    if not mo:
        return False
    if mo.get("order_status") in ("paid", "closed"):
        return True
    for p in mo.get("payments", []) or []:
        if p.get("status") == "approved":
            return True
    return False

def _fetch_merchant_order_by_pref_or_ref(preference_id: str, external_reference: str | None = None) -> dict | None:
    # Tenta buscar pelo preference_id via search, depois por external_reference
    try:
        q = {"preference_id": preference_id}
        res = sdk.merchant_order().search(q)
        if res and res.get("status") in (200, 201) and res.get("response", {}).get("elements"):
            return res["response"]["elements"][0]
    except Exception:
        pass
    if external_reference:
        try:
            res = sdk.merchant_order().search({"external_reference": external_reference})
            if res and res.get("status") in (200, 201) and res.get("response", {}).get("elements"):
                return res["response"]["elements"][0]
        except Exception:
            pass
    return None

def processar_webhook(payload: dict):
    """Processa webhook do MP de forma idempotente e segura."""
    # Extrai preference/external_reference de diferentes formatos de webhook
    pref = (
        (payload.get("data") or {}).get("id")
        or payload.get("id")
        or payload.get("preference_id")
    )
    external_reference = (
        (payload.get("data") or {}).get("external_reference")
        or payload.get("external_reference")
    )
    if not pref and not external_reference:
        return {"ok": False, "reason": "no_reference"}

    pag = None
    if pref:
        pag = Pagamento.objects.filter(preference_id=pref).select_related("pedido").first()
    if not pag and external_reference:
        try:
            pedido = Pedido.objects.filter(pk=int(external_reference)).first()
            if pedido:
                pag = Pagamento.objects.filter(pedido=pedido).select_related("pedido").first()
        except Exception:
            pass
    if not pag:
        return {"ok": False, "reason": "payment_not_found"}

    # Idempotência
    if pag.status == "approved" or (pag.pedido and pag.pedido.status == "pago"):
        return {"ok": True, "idempotent": True}

    mo = _fetch_merchant_order_by_pref_or_ref(pag.preference_id, external_reference=str(pag.pedido_id))
    if not _is_paid_merchant_order(mo):
        # guarda o raw recebido para auditoria mesmo assim
        pag.raw = {"webhook": payload, "merchant_order": mo or {}}
        pag.status_detail = (mo or {}).get("order_status") or "pending"
        pag.save(update_fields=["raw", "status_detail", "updated_at"])
        return {"ok": True, "paid": False}

    # Aplicar aprovação de forma transacional e atualizar vendidos
    with transaction.atomic():
        # Recarrega com lock das linhas de itens
        pag = (
            Pagamento.objects.select_for_update()
            .select_related("pedido")
            .get(pk=pag.pk)
        )
        if pag.status == "approved" or pag.pedido.status == "pago":
            return {"ok": True, "idempotent": True}

        itens = (
            PedidoItem.objects.select_related("item")
            .filter(pedido=pag.pedido)
        )
        # Lock nos itens para ajustar vendidos
        item_ids = [pi.item_id for pi in itens]
        items_locked = list(Item.objects.select_for_update().filter(id__in=item_ids))
        map_items = {it.id: it for it in items_locked}

        for pi in itens:
            it = map_items.get(pi.item_id)
            if not it:
                continue
            # Atualiza vendidos sem ultrapassar estoque_inicial
            novos_vendidos = it.vendidos + pi.qtd
            if it.estoque_inicial is not None:
                max_vendidos = max(it.estoque_inicial, 0)
                if novos_vendidos > max_vendidos:
                    novos_vendidos = max_vendidos
            it.vendidos = novos_vendidos
            it.save(update_fields=["vendidos"])

        pag.status = "approved"
        pag.status_detail = "approved"
        pag.raw = {"webhook": payload, "merchant_order": mo}
        pag.pedido.status = "pago"
        if not pag.pedido.paid_at:
            pag.pedido.paid_at = timezone.now()
        pag.pedido.save(update_fields=["status", "paid_at"]) 
        pag.save(update_fields=["status", "status_detail", "raw", "updated_at"])

    # Broadcast atualização do pedido
    try:
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(
            "orders", {"type": "orders.event", "data": {"event": "order_paid", "id": pag.pedido.id, "status": pag.pedido.status}}
        )
    except Exception:
        pass

    return {"ok": True, "paid": True}


def criar_pagamento_pix(pedido_id: int, payer: dict | None = None):
    """Cria um pagamento PIX (Payments API) para o pedido informado.
    Retorna o objeto de pagamento do MP.
    """
    pedido = Pedido.objects.get(pk=pedido_id)
    pag_data = {
        "transaction_amount": float(pedido.valor_total),
        "description": f"Pedido #{pedido.id}",
        "payment_method_id": "pix",
        "external_reference": str(pedido.id),
        "notification_url": f"{settings.BACKEND_URL}/api/payments/webhook",
        "payer": payer or {"email": f"cliente{pedido.id}@example.com"},
    }
    resp = sdk.payment().create(pag_data)
    if resp.get("status") not in (200, 201):
        raise RuntimeError(resp)
    data = resp["response"]
    # mantém referência no pedido
    Pagamento.objects.update_or_create(
        pedido=pedido,
        defaults={
            "preference_id": data.get("id"),
            "status": data.get("status") or "pending",
            "init_point": data.get("point_of_interaction", {})
                           .get("transaction_data", {})
                           .get("ticket_url", ""),
            "raw": data,
        },
    )
    return data
