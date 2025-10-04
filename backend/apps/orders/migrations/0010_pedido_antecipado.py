from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0009_dashboarduser"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="antecipado",
            field=models.BooleanField(default=False),
        ),
    ]
