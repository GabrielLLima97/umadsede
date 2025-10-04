from rest_framework import serializers
from .models import Item, Pedido, PedidoItem, CategoryOrder, DashboardUser
from .auth_utils import hash_password

class ItemSerializer(serializers.ModelSerializer):
    estoque_disponivel = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = "__all__"

    def get_estoque_disponivel(self, obj):
        if hasattr(obj, "estoque_disponivel_calc"):
            try:
                return max(int(obj.estoque_disponivel_calc), 0)
            except (TypeError, ValueError):
                pass
        try:
            return max(int(getattr(obj, "estoque_disponivel")), 0)
        except (TypeError, ValueError, AttributeError):
            pass
        estoque_inicial = getattr(obj, "estoque_inicial", 0) or 0
        vendidos = getattr(obj, "vendidos", 0) or 0
        try:
            return max(int(estoque_inicial) - int(vendidos), 0)
        except (TypeError, ValueError):
            return 0

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
            "precisa_embalagem","antecipado",
            "created_at","paid_at","itens"
        ]

    def get_precisa_embalagem(self, obj):
        value = getattr(obj, "precisa_embalagem", False)
        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized in {"1", "true", "t", "sim", "yes"}
        return bool(value)


class CategoryOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryOrder
        fields = "__all__"

    def validate_nome(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Nome é obrigatório")
        return value

    def validate_ordem(self, value):
        try:
            return int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Ordem deve ser um número inteiro")


class DashboardUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = DashboardUser
        fields = [
            "id",
            "username",
            "name",
            "allowed_routes",
            "is_active",
            "created_at",
            "updated_at",
            "password",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_allowed_routes(self, value):
        if value is None:
            return []
        if not isinstance(value, (list, tuple)):
            raise serializers.ValidationError("Informe uma lista de rotas permitidas.")
        return list({str(v) for v in value})

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Senha obrigatória"})
        validated_data["password_hash"] = hash_password(password)
        return DashboardUser.objects.create(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if password:
            instance.password_hash = hash_password(password)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
