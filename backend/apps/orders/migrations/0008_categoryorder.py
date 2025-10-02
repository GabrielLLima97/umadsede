from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0007_pedido_precisa_embalagem"),
    ]

    operations = [
        migrations.CreateModel(
            name="CategoryOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=120, unique=True)),
                ("ordem", models.IntegerField(default=100)),
            ],
            options={
                "ordering": ["ordem", "nome"],
            },
        ),
    ]
