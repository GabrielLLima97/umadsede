from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from django.db import transaction, connection
from decimal import Decimal
from django.db.models import Q, Sum, F, Value, IntegerField, Case, When
from django.db.models.functions import Coalesce, Greatest
from django.conf import settings
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import os
import psutil
import redis

from .models import Item, Pedido, CategoryOrder, DashboardUser, AuthToken
from .serializers import (
    ItemSerializer,
    PedidoSerializer,
    CategoryOrderSerializer,
    DashboardUserSerializer,
)
from .services.mercadopago import criar_preferencia, processar_webhook, criar_pagamento_pix
from .auth_utils import (
    authenticate_dashboard,
    require_dashboard_user,
    verify_password,
    create_token,
    invalidate_token,
)

class ItemView(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Item.objects.all()
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
        vendas_confirmadas = Coalesce(
            Sum(
                "pedidoitem__qtd",
                filter=Q(pedidoitem__pedido__paid_at__isnull=False)
            ),
            Value(0, output_field=IntegerField()),
        )
        qs = qs.annotate(
            vendidos_confirmados=vendas_confirmadas,
        ).annotate(
            estoque_disponivel_calc=Greatest(
                Value(0, output_field=IntegerField()),
                F("estoque_inicial") - F("vendidos_confirmados"),
            )
        )

        orders = list(CategoryOrder.objects.all())
        if orders:
            whens = [
                When(categoria__iexact=cat.nome, then=Value(cat.ordem))
                for cat in orders
            ]
            categoria_ordem = Case(
                *whens,
                default=Value(999, output_field=IntegerField()),
                output_field=IntegerField(),
            )
            qs = qs.annotate(categoria_ordem=categoria_ordem).order_by("categoria_ordem", "categoria", "nome")
        else:
            qs = qs.order_by("categoria", "nome")
        return qs

    def get_object(self):
        # Para operações de detalhe (retrieve/update/partial_update/destroy)
        # não aplicamos filtros de 'ativo' ou de busca; buscamos direto por PK
        from .models import Item
        return Item.objects.get(pk=self.kwargs.get(self.lookup_field or 'pk'))

    # Endpoints auxiliares para contornar ambientes onde o detalhe pode falhar por filtros/roteamento
    @action(detail=False, methods=["post"], url_path="toggle_active")
    def toggle_active(self, request):
        require_dashboard_user(request, routes=["itens", "estoque"])
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
        require_dashboard_user(request, routes=["itens", "estoque"])
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

    def get_permissions(self):
        if self.action in ["create"]:
            return [permissions.AllowAny()]
        return [permissions.AllowAny()]  # controlado manualmente

    def get_queryset(self):
        if self.request.method == "GET" and self.action == "list":
            require_dashboard_user(self.request, routes=["vendas", "cozinha", "tv", "pagamentos", "dashboard", "estoque"])
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

        precisa_embalagem = data.get("precisa_embalagem", False)
        if isinstance(precisa_embalagem, str):
            precisa_embalagem = precisa_embalagem.strip().lower() in {"1", "true", "t", "sim", "yes"}
        else:
            precisa_embalagem = bool(precisa_embalagem)

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
                precisa_embalagem=precisa_embalagem,
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
        require_dashboard_user(request, routes=["vendas", "cozinha"])
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


class CategoryOrderView(viewsets.ModelViewSet):
    queryset = CategoryOrder.objects.all().order_by("ordem", "nome")
    serializer_class = CategoryOrderSerializer

    def get_permissions(self):
        return [permissions.AllowAny()]

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        require_dashboard_user(self.request, routes=["itens"])
        nome = serializer.validated_data.get("nome", "")
        serializer.save(nome=str(nome).strip())

    def perform_update(self, serializer):
        require_dashboard_user(self.request, routes=["itens"])
        data = serializer.validated_data
        if "nome" in data and data["nome"] is not None:
            serializer.save(nome=str(data["nome"]).strip())
        else:
            serializer.save()
 
    def destroy(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["itens"])
        return super().destroy(request, *args, **kwargs)

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
    payment_identifier = pag.pedido.provider_payment_id or pag.preference_id
    payload = {
        "external_reference": str(pedido_id),
    }
    if payment_identifier:
        payload.update({
            "type": "payment",
            "data": {"id": payment_identifier},
        })
    # Fallback: mantém preference_id para compatibilidade com preferências antigas
    if pag.preference_id:
        payload["preference_id"] = pag.preference_id
    result = processar_webhook(payload)
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
    cats = list(Item.objects.filter(ativo=True).values_list("categoria", flat=True).distinct())
    cats = [c or "Outros" for c in cats]
    order_map = {c.nome.lower(): c.ordem for c in CategoryOrder.objects.all()}
    fallback = {"hamburguer": 0, "drink": 1, "bebidas": 2}

    def score(cat: str):
        key = (cat or "").lower()
        return order_map.get(key, fallback.get(key, 999))

    cats.sort(key=lambda c: (score(c), c.lower()))
    return Response(cats)


ROUTE_OPTIONS = [
    {"key": "dashboard", "label": "Dashboard"},
    {"key": "vendas", "label": "Vendas (Caixa)"},
    {"key": "cozinha", "label": "Cozinha"},
    {"key": "tv", "label": "TV"},
    {"key": "itens", "label": "Itens"},
    {"key": "estoque", "label": "Estoque"},
    {"key": "pagamentos", "label": "Pagamentos"},
    {"key": "config", "label": "Configurações"},
]


@api_view(["GET"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def admin_routes(request):
    require_dashboard_user(request)
    return Response(ROUTE_OPTIONS)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def admin_metrics(request):
    require_dashboard_user(request)
    systems = []
    # Database
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        systems.append({"name": "Banco de Dados", "status": "online"})
    except Exception as exc:
        systems.append({"name": "Banco de Dados", "status": "offline", "detail": str(exc)})
    # Redis
    try:
        host = os.getenv("REDIS_HOST", "redis")
        port = int(os.getenv("REDIS_PORT", "6379"))
        client = redis.Redis(host=host, port=port, db=0, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        systems.append({"name": "Redis", "status": "online"})
    except Exception as exc:
        systems.append({"name": "Redis", "status": "offline", "detail": str(exc)})
    # Mercado Pago
    mp_status = "online" if settings.MP_ACCESS_TOKEN else "offline"
    systems.append({"name": "Mercado Pago", "status": mp_status})

    now = timezone.now()
    active_tokens = AuthToken.objects.filter(is_active=True, expires_at__gt=now).count()
    active_users = (
        AuthToken.objects.filter(is_active=True, expires_at__gt=now)
        .values("user_id")
        .distinct()
        .count()
    )

    cpu_percent = psutil.cpu_percent(interval=0.1)
    virtual = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    load_avg = None
    try:
        load_avg = psutil.getloadavg()
    except (AttributeError, OSError):
        load_avg = None

    instance = {
        "cpu_percent": cpu_percent,
        "memory_percent": virtual.percent,
        "memory_total": virtual.total,
        "memory_used": virtual.used,
        "disk_percent": disk.percent,
        "disk_total": disk.total,
        "disk_used": disk.used,
        "uptime_seconds": max(0, int(now.timestamp() - psutil.boot_time())),
    }
    if load_avg:
        instance["load_avg"] = load_avg

    return Response({
        "timestamp": now,
        "systems": systems,
        "connections": {
            "active_tokens": active_tokens,
            "active_users": active_users,
        },
        "instance": instance,
    })


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def admin_login(request):
    username = (request.data.get("username") or "").strip().lower()
    password = request.data.get("password") or ""
    user = DashboardUser.objects.filter(username__iexact=username, is_active=True).first()
    if not user or not verify_password(password, user.password_hash):
        raise AuthenticationFailed("Credenciais inválidas")
    token = create_token(
        user,
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ip=request.META.get("REMOTE_ADDR", ""),
    )
    data = DashboardUserSerializer(user).data
    return Response({
        "token": token.key,
        "expires_at": token.expires_at,
        "user": data,
    })


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def admin_logout(request):
    token = getattr(request, "_cached_dashboard_token", None)
    if not token:
        auth = authenticate_dashboard(request)
        token = getattr(request, "_cached_dashboard_token", None) if auth else None
    if token:
        invalidate_token(token)
    return Response({"ok": True})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def admin_me(request):
    user = require_dashboard_user(request)
    return Response({"user": DashboardUserSerializer(user).data})


class DashboardUserViewSet(viewsets.ModelViewSet):
    serializer_class = DashboardUserSerializer
    queryset = DashboardUser.objects.all().order_by("username")

    def list(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        require_dashboard_user(request, routes=["config"])
        return super().destroy(request, *args, **kwargs)
