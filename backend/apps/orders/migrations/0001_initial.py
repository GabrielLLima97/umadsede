from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Item',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('sku', models.PositiveIntegerField(unique=True)),
                ('nome', models.CharField(max_length=200)),
                ('descricao', models.TextField(blank=True)),
                ('preco', models.DecimalField(decimal_places=2, max_digits=9)),
                ('categoria', models.CharField(blank=True, max_length=120)),
                ('imagem_url', models.URLField(blank=True)),
                ('ativo', models.BooleanField(default=True)),
                ('estoque_inicial', models.IntegerField(default=0)),
                ('vendidos', models.IntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name='Pedido',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('cliente_nome', models.CharField(max_length=120)),
                ('cliente_waid', models.CharField(blank=True, max_length=20)),
                ('valor_total', models.DecimalField(decimal_places=2, default=0, max_digits=9)),
                ('status', models.CharField(choices=[('aguardando pagamento','aguardando pagamento'),('pago','pago'),('a preparar','a preparar'),('em produção','em produção'),('pronto','pronto'),('finalizado','finalizado'),('cancelado','cancelado')], default='aguardando pagamento', max_length=32)),
                ('meio_pagamento', models.CharField(default='Mercado Pago', max_length=60)),
                ('provider_payment_id', models.CharField(blank=True, max_length=120)),
                ('payment_link', models.URLField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='PedidoItem',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('nome', models.CharField(max_length=200)),
                ('preco', models.DecimalField(decimal_places=2, max_digits=9)),
                ('qtd', models.PositiveIntegerField()),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='orders.item')),
                ('pedido', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='itens', to='orders.pedido')),
            ],
        ),
        migrations.CreateModel(
            name='StatusLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('de', models.CharField(blank=True, max_length=32)),
                ('para', models.CharField(max_length=32)),
                ('quando', models.DateTimeField(auto_now_add=True)),
                ('pedido', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='orders.pedido')),
            ],
        ),
        migrations.CreateModel(
            name='Pagamento',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('preference_id', models.CharField(max_length=120)),
                ('status', models.CharField(default='pending', max_length=32)),
                ('raw', models.JSONField(default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('pedido', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='orders.pedido')),
            ],
        ),
    ]
