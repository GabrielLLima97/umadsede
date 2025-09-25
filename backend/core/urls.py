from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from apps.orders.views import ItemView, PedidoView, criar_preference_view, webhook_mp, sync_payment, categories_view, create_pix_payment

router = DefaultRouter()
router.register("items", ItemView, basename="items")
router.register("orders", PedidoView, basename="orders")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/payments/preference", criar_preference_view),
    path("api/payments/webhook", webhook_mp),
    path("api/payments/sync", sync_payment),
    path("api/payments/pix", create_pix_payment),
    path("api/categories", categories_view),
    path("healthz", lambda r: JsonResponse({"ok": True})),
]
