from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from apps.orders.views import (
    ItemView,
    PedidoView,
    criar_preference_view,
    webhook_mp,
    sync_payment,
    categories_view,
    create_pix_payment,
    CategoryOrderView,
    admin_login,
    admin_logout,
    admin_me,
    admin_routes,
    admin_metrics,
    admin_metrics_history,
    admin_reset_sales,
    DashboardUserViewSet,
)

router = DefaultRouter()
router.register("items", ItemView, basename="items")
router.register("orders", PedidoView, basename="orders")
router.register("category-order", CategoryOrderView, basename="category-order")
router.register("admin/users", DashboardUserViewSet, basename="dashboard-users")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/payments/preference", criar_preference_view),
    path("api/payments/webhook", webhook_mp),
    path("api/payments/sync", sync_payment),
    path("api/payments/pix", create_pix_payment),
    path("api/categories", categories_view),
    path("api/admin/auth/login", admin_login),
    path("api/admin/auth/logout", admin_logout),
    path("api/admin/auth/me", admin_me),
    path("api/admin/routes", admin_routes),
    path("api/admin/metrics", admin_metrics),
    path("api/admin/metrics/history", admin_metrics_history),
    path("api/admin/reset-sales", admin_reset_sales),
    path("healthz", lambda r: JsonResponse({"ok": True})),
]
