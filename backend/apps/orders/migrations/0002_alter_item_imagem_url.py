from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="imagem_url",
            field=models.URLField(blank=True, max_length=1024),
        ),
    ]

