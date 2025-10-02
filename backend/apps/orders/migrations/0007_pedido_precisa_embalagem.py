from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_alter_item_imagem_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="precisa_embalagem",
            field=models.BooleanField(default=False),
        ),
    ]
