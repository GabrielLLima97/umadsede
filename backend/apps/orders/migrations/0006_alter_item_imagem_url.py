from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0005_add_pedido_observacoes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="imagem_url",
            field=models.TextField(blank=True),
        ),
    ]

