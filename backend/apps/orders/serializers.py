from rest_framework import serializers
from .models import Item, Pedido, PedidoItem
from decimal import Decimal

class ItemSerializer(serializers.ModelSerializer):
    estoque_disponivel = serializers.IntegerField(read_only=True)
    class Meta:
        model = Item
        fields = "__all__"

class PedidoItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PedidoItem
        fields = ["item","nome","preco","qtd"]

class PedidoSerializer(serializers.ModelSerializer):
    itens = PedidoItemSerializer(many=True, read_only=True)
    class Meta:
        model = Pedido
        fields = [
            "id","cliente_nome","cliente_waid","valor_total","status",
            "meio_pagamento","provider_payment_id","payment_link","observacoes",
            "created_at","paid_at","itens"
        ]
