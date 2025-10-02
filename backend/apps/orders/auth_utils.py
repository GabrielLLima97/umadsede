import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from .models import DashboardUser, AuthToken


TOKEN_TTL_HOURS = 24


def hash_password(raw: str) -> str:
    return make_password(raw)


def verify_password(raw: str, password_hash: str) -> bool:
    return check_password(raw, password_hash)


def _authenticate_header(request):
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return None
    return header.split(" ", 1)[1].strip()


def authenticate_dashboard(request):
    if hasattr(request, "_cached_dashboard_user"):
        return request._cached_dashboard_user
    token_value = _authenticate_header(request)
    if not token_value:
        request._cached_dashboard_user = None
        return None
    now = timezone.now()
    token = (
        AuthToken.objects
        .select_related("user")
        .filter(key=token_value, is_active=True, expires_at__gt=now)
        .first()
    )
    if not token or not token.user.is_active:
        request._cached_dashboard_user = None
        return None
    request._cached_dashboard_user = token.user
    request._cached_dashboard_token = token
    return token.user


def require_dashboard_user(request, routes=None):
    user = authenticate_dashboard(request)
    if not user:
        raise AuthenticationFailed("Autenticação necessária")
    if routes:
        allowed = set(user.allowed_routes or [])
        if not any(route in allowed for route in routes):
            raise PermissionDenied("Você não tem permissão para acessar esta área.")
    return user


def create_token(user: DashboardUser, user_agent: str = "", ip: str = "") -> AuthToken:
    token = secrets.token_urlsafe(32)
    now = timezone.now()
    return AuthToken.objects.create(
        key=token,
        user=user,
        created_at=now,
        expires_at=now + timedelta(hours=TOKEN_TTL_HOURS),
        is_active=True,
        user_agent=user_agent[:255],
        ip_address=ip[:64],
    )


def invalidate_token(token: AuthToken):
    token.is_active = False
    token.save(update_fields=["is_active"])
