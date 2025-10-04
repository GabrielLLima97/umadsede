from django.db import models

class Item(models.Model):
    sku = models.PositiveIntegerField(unique=True)
    nome = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    preco = models.DecimalField(max_digits=9, decimal_places=2)
    categoria = models.CharField(max_length=120, blank=True)
    # Aceita URL ou base64/paths longos
    imagem_url = models.TextField(blank=True)
    ativo = models.BooleanField(default=True)
    estoque_inicial = models.IntegerField(default=0)
    vendidos = models.IntegerField(default=0)

    @property
    def estoque_disponivel(self):
        return max(self.estoque_inicial - self.vendidos, 0)


class CategoryOrder(models.Model):
    nome = models.CharField(max_length=120, unique=True)
    ordem = models.IntegerField(default=100)

    class Meta:
        ordering = ["ordem", "nome"]

    def __str__(self):
        return f"{self.nome} ({self.ordem})"

class Pedido(models.Model):
    STATUS = [
        ("aguardando pagamento","aguardando pagamento"),
        ("pago","pago"),
        ("a preparar","a preparar"),
        ("em produção","em produção"),
        ("pronto","pronto"),
        ("finalizado","finalizado"),
        ("cancelado","cancelado"),
    ]
    cliente_nome = models.CharField(max_length=120)
    cliente_waid = models.CharField(max_length=20, blank=True)
    valor_total = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    status = models.CharField(max_length=32, choices=STATUS, default="aguardando pagamento")
    meio_pagamento = models.CharField(max_length=60, default="Mercado Pago")
    provider_payment_id = models.CharField(max_length=120, blank=True)
    payment_link = models.URLField(blank=True)
    observacoes = models.TextField(blank=True)
    precisa_embalagem = models.BooleanField(default=False)
    antecipado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

class PedidoItem(models.Model):
    pedido = models.ForeignKey(Pedido, related_name="itens", on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    nome = models.CharField(max_length=200)
    preco = models.DecimalField(max_digits=9, decimal_places=2)
    qtd = models.PositiveIntegerField()

class StatusLog(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE)
    de = models.CharField(max_length=32, blank=True)
    para = models.CharField(max_length=32)
    quando = models.DateTimeField(auto_now_add=True)

class Pagamento(models.Model):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE)
    preference_id = models.CharField(max_length=120)
    status = models.CharField(max_length=32, default="pending")
    status_detail = models.CharField(max_length=64, blank=True)
    init_point = models.URLField(blank=True, max_length=1024)
    raw = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class DashboardUser(models.Model):
    username = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=120, blank=True)
    password_hash = models.CharField(max_length=128)
    allowed_routes = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return self.username


class AuthToken(models.Model):
    key = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(DashboardUser, on_delete=models.CASCADE, related_name="tokens")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    user_agent = models.CharField(max_length=255, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [models.Index(fields=["key", "is_active"])]

    def __str__(self):
        return f"token:{self.user.username}:{self.key[:6]}"
