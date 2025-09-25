from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_alter_item_imagem_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="pagamento",
            name="status_detail",
            field=models.CharField(max_length=64, blank=True),
        ),
        migrations.AddField(
            model_name="pagamento",
            name="init_point",
            field=models.URLField(blank=True, max_length=1024),
        ),
    ]

