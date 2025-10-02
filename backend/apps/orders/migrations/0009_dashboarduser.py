from django.db import migrations, models
from django.contrib.auth.hashers import make_password
import os


def create_default_dashboard_user(apps, schema_editor):
    DashboardUser = apps.get_model("orders", "DashboardUser")
    username = os.getenv("DASHBOARD_DEFAULT_ADMIN_USER") or os.getenv("DASHBOARD_DEFAULT_ADMIN_USERNAME")
    password = os.getenv("DASHBOARD_DEFAULT_ADMIN_PASSWORD")
    if not username or not password:
        return
    if DashboardUser.objects.filter(username=username).exists():
        return
    DashboardUser.objects.create(
        username=username,
        name="Administrador",
        password_hash=make_password(password),
        allowed_routes=["dashboard", "vendas", "cozinha", "tv", "itens", "estoque", "pagamentos", "config"],
        is_active=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0008_categoryorder"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardUser",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(max_length=60, unique=True)),
                ("name", models.CharField(blank=True, max_length=120)),
                ("password_hash", models.CharField(max_length=128)),
                ("allowed_routes", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["username"]},
        ),
        migrations.CreateModel(
            name="AuthToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("is_active", models.BooleanField(default=True)),
                ("user_agent", models.CharField(blank=True, max_length=255)),
                ("ip_address", models.CharField(blank=True, max_length=64)),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="tokens", to="orders.dashboarduser")),
            ],
        ),
        migrations.AddIndex(
            model_name="authtoken",
            index=models.Index(fields=["key", "is_active"], name="orders_auth_token_key_active_idx"),
        ),
        migrations.RunPython(create_default_dashboard_user, migrations.RunPython.noop),
    ]
