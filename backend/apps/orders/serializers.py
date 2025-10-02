from rest_framework import serializers
from .models import Item, Pedido, PedidoItem

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
    precisa_embalagem = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id","cliente_nome","cliente_waid","valor_total","status",
            "meio_pagamento","provider_payment_id","payment_link","observacoes",
            "precisa_embalagem",
            "created_at","paid_at","itens"
        ]

    def get_precisa_embalagem(self, obj):
        value = getattr(obj, "precisa_embalagem", False)
        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized in {"1", "true", "t", "sim", "yes"}
        return bool(value)
