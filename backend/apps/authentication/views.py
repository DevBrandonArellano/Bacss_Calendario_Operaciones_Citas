import logging

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.models import AuditAction
from apps.audit.services import log_action
from apps.authentication.serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    build_password_reset_link,
)
from apps.authentication.throttles import AuthRateThrottle
from apps.users.models import User
from apps.users.serializers import UserSerializer

logger = logging.getLogger("app")


def _client_ip(request) -> str | None:
    return request.META.get("REMOTE_ADDR")


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info(
            "Organización y usuario admin registrados",
            extra={"event": "auth.register", "severity": "notice", "data": {"user_id": str(user.id)}},
        )
        return Response(UserSerializer(user).data, status=201)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get("email")
            user = User.objects.filter(email__iexact=email).first()
            if user is not None:
                log_action(
                    action=AuditAction.LOGIN,
                    entity_type="User",
                    entity_id=str(user.id),
                    organization=user.organization,
                    user=user,
                    ip_address=_client_ip(request),
                )
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"


class LogoutView(APIView):
    """Invalida el refresh token (revocación, ver docs/auth-rbac.md)."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken

        from core import exceptions as domain_exceptions

        refresh = request.data.get("refresh")
        if not refresh:
            raise domain_exceptions.ValidationError("Falta el refresh token.")
        try:
            token = RefreshToken(refresh)
            user_id = token.payload.get("user_id")
            token.blacklist()
        except TokenError as exc:
            raise domain_exceptions.ValidationError("Token inválido o ya revocado.") from exc

        user = User.objects.filter(id=user_id).first() if user_id else None
        if user is not None:
            log_action(
                action=AuditAction.LOGOUT,
                entity_type="User",
                entity_id=str(user.id),
                organization=user.organization,
                user=user,
                ip_address=_client_ip(request),
            )
        return Response(status=204)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            uid, token = build_password_reset_link(user)
            reset_url = f"{settings.FRONTEND_PASSWORD_RESET_URL}?uid={uid}&token={token}"
            send_mail(
                subject="Recupera tu contraseña",
                message=f"Usa este enlace para restablecer tu contraseña: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        # Respuesta idéntica exista o no el usuario: no se revela si un email está registrado.
        return Response({"detail": "Si el email existe, se envió un enlace de recuperación."}, status=200)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Contraseña actualizada."}, status=200)
