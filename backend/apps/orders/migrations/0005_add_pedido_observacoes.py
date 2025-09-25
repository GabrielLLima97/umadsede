from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0004_alter_item_id_alter_pagamento_id_alter_pedido_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="observacoes",
            field=models.TextField(blank=True),
        ),
    ]

