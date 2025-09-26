from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from .models import Item, Pedido
from .serializers import ItemSerializer, PedidoSerializer
from .services.mercadopago import criar_preferencia, processar_webhook, criar_pagamento_pix
from .models import Pedido
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from decimal import Decimal

class ItemView(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Item.objects.all().order_by("categoria", "nome")
        all_param = self.request.query_params.get("all")
        # Para operações de detalhe/alteração, não filtrar por ativo;
        # filtra apenas na listagem quando 'all' não foi informado.
        if self.action == "list" and not all_param:
            qs = qs.filter(ativo=True)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(nome__icontains=q) | Q(descricao__icontains=q) | Q(categoria__icontains=q))
        cat = (self.request.query_params.get("category") or "").strip()
        if cat:
            qs = qs.filter(categoria=cat)
        return qs

    def get_object(self):
        # Para operações de detalhe (retrieve/update/partial_update/destroy)
        # não aplicamos filtros de 'ativo' ou de busca; buscamos direto por PK
        from .models import Item
        return Item.objects.get(pk=self.kwargs.get(self.lookup_field or 'pk'))

    # Endpoints auxiliares para contornar ambientes onde o detalhe pode falhar por filtros/roteamento
    @action(detail=False, methods=["post"], url_path="toggle_active")
    def toggle_active(self, request):
        from .models import Item
        try:
            pk = int(request.data.get("id"))
        except Exception:
            return Response({"detail": "id inválido"}, status=status.HTTP_400_BAD_REQUEST)
        it = Item.objects.filter(pk=pk).first()
        if not it:
            return Response({"detail": "Item não encontrado"}, status=status.HTTP_404_NOT_FOUND)
        it.ativo = bool(request.data.get("ativo"))
        it.save(update_fields=["ativo"])
        return Response(ItemSerializer(it).data)

    @action(detail=False, methods=["patch"], url_path="update_item")
    def update_item(self, request):
        from .models import Item
        try:
            pk = int(request.data.get("id"))
        except Exception:
            return Response({"detail": "id inválido"}, status=status.HTTP_400_BAD_REQUEST)
        it = Item.objects.filter(pk=pk).first()
        if not it:
            return Response({"detail": "Item não encontrado"}, status=status.HTTP_404_NOT_FOUND)
        ser = ItemSerializer(it, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

class PedidoView(viewsets.ModelViewSet):
    queryset = Pedido.objects.all().order_by("-id")
    serializer_class = PedidoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        itens_in = data.get("itens", [])
        if not isinstance(itens_in, list) or not itens_in:
            return Response({"detail": "itens obrigatórios"}, status=status.HTTP_400_BAD_REQUEST)

        nome = data.get("cliente_nome", "").strip()
        waid = data.get("cliente_waid", "").strip()
        # normalização simples de WA: manter dígitos
        waid = "".join([c for c in waid if c.isdigit()])

        # Carregar itens por sku ou id e validar estoque
        items_map_by_sku = {it.sku: it for it in Item.objects.all()}

        pedido_itens = []
        total = Decimal("0.00")
        for it in itens_in:
            sku = it.get("sku")
            qtd = int(it.get("qtd", 0) or 0)
            if not sku or qtd <= 0:
                return Response({"detail": "sku e qtd válidos são obrigatórios"}, status=status.HTTP_400_BAD_REQUEST)
            item = items_map_by_sku.get(int(sku))
            if not item or not item.ativo:
                return Response({"detail": f"SKU {sku} inválido"}, status=status.HTTP_400_BAD_REQUEST)
            # valida estoque
            if item.estoque_inicial is not None:
                disponivel = max(item.estoque_inicial - item.vendidos, 0)
                if qtd > disponivel:
                    return Response({"detail": f"SKU {sku} sem estoque suficiente"}, status=status.HTTP_400_BAD_REQUEST)
            preco = Decimal(str(item.preco))
            total += (preco * Decimal(qtd))
            pedido_itens.append({
                "item": item,
                "nome": item.nome,
                "preco": preco,
                "qtd": qtd,
            })

        with transaction.atomic():
            pedido = Pedido.objects.create(
                cliente_nome=nome,
                cliente_waid=waid,
                valor_total=total,
                status="aguardando pagamento",
                meio_pagamento=(data.get("meio_pagamento") or "Mercado Pago"),
                observacoes=(data.get("observacoes") or ""),
            )
            from .models import PedidoItem as PI
            for it in pedido_itens:
                PI.objects.create(
                    pedido=pedido,
                    item=it["item"],
                    nome=it["nome"],
                    preco=it["preco"],
                    qtd=it["qtd"],
                )
        ser = PedidoSerializer(pedido)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        pedido = self.get_object()
        de = pedido.status
        novo = request.data.get("status", de)
        with transaction.atomic():
            pedido = self.get_object()
            de = pedido.status
            pedido.status = novo
            aprovando = (de != "pago" and novo == "pago" and not pedido.paid_at)
            if aprovando:
                # marca pago e atualiza vendidos/estoque
                pedido.paid_at = timezone.now()
                from .models import PedidoItem, Item
                itens = PedidoItem.objects.select_related("item").filter(pedido=pedido)
                # lock itens de estoque
                item_ids = [pi.item_id for pi in itens]
                items_locked = list(Item.objects.select_for_update().filter(id__in=item_ids))
                map_items = {it.id: it for it in items_locked}
                for pi in itens:
                    it = map_items.get(pi.item_id)
                    if not it: continue
                    limite = getattr(it, "estoque_inicial", None)
                    if isinstance(limite, int) and limite > 0:
                        it.vendidos = min(it.vendidos + pi.qtd, limite)
                    else:
                        it.vendidos = it.vendidos + pi.qtd
                    it.save(update_fields=["vendidos"])
            pedido.save()
        # broadcast
        try:
            layer = get_channel_layer()
            async_to_sync(layer.group_send)(
                "orders", {"type": "orders.event", "data": {"event": "order_updated", "id": pedido.id, "status": pedido.status}}
            )
        except Exception:
            pass
        return Response({"ok": True, "de": de, "para": pedido.status})

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def criar_preference_view(request):
    pedido_id = (
        request.data.get("pedido_id")
        or request.data.get("id")
        or request.query_params.get("pedido_id")
        or request.query_params.get("id")
    )
    if not pedido_id:
        return Response({"detail": "pedido_id obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        pedido_id = int(pedido_id)
    except Exception:
        return Response({"detail": "pedido_id inválido"}, status=status.HTTP_400_BAD_REQUEST)
    if not Pedido.objects.filter(pk=pedido_id).exists():
        return Response({"detail": "Pedido não encontrado"}, status=status.HTTP_404_NOT_FOUND)
    ped = Pedido.objects.get(pk=pedido_id)
    # aceitar valores >= 0,01 para não bloquear testes/pedidos pequenos
    if ped.valor_total is None or Decimal(str(ped.valor_total)) < Decimal("0.01"):
        return Response({"detail": "Valor do pedido inválido"}, status=status.HTTP_400_BAD_REQUEST)
    return Response(criar_preferencia(pedido_id))

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def webhook_mp(request):
    result = processar_webhook(request.data or {})
    return Response(result)

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def sync_payment(request):
    pedido_id = request.data.get("pedido_id") or request.query_params.get("pedido_id")
    if not pedido_id:
        return Response({"detail": "pedido_id obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        pedido_id = int(pedido_id)
    except Exception:
        return Response({"detail": "pedido_id inválido"}, status=status.HTTP_400_BAD_REQUEST)
    from .models import Pagamento
    pag = Pagamento.objects.filter(pedido_id=pedido_id).first()
    if not pag:
        return Response({"detail": "Pagamento não encontrado para este pedido"}, status=status.HTTP_404_NOT_FOUND)
    # Força processamento usando preference_id/external_reference
    result = processar_webhook({
        "preference_id": pag.preference_id,
        "external_reference": str(pedido_id),
    })
    return Response(result)

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def create_pix_payment(request):
    """Cria um pagamento PIX (Payments API) e retorna os dados para exibição (QR Code/URL)."""
    pedido_id = request.data.get("pedido_id") or request.query_params.get("pedido_id")
    if not pedido_id:
        return Response({"detail": "pedido_id obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        pedido_id = int(pedido_id)
    except Exception:
        return Response({"detail": "pedido_id inválido"}, status=status.HTTP_400_BAD_REQUEST)
    payer = request.data.get("payer") or {}
    data = criar_pagamento_pix(pedido_id, payer)
    return Response(data)

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def categories_view(request):
    cats = list(Item.objects.filter(ativo=True).values_list("categoria", flat=True).distinct().order_by("categoria"))
    cats = [c or "Outros" for c in cats]
    return Response(cats)
