from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

from apps.organizations.models import Organization
from apps.users.models import Role, SystemRoleCode, User
from core import exceptions as domain_exceptions


class RegisterSerializer(serializers.Serializer):
    """Alta de una nueva organización (trial) con su primer usuario Admin."""

    organization_name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def create(self, validated_data) -> User:
        organization = Organization.objects.create(name=validated_data["organization_name"])
        user = User.objects.create_user(
            organization=organization,
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        admin_role, _ = Role.objects.get_or_create(
            organization=None,
            code=SystemRoleCode.ORG_ADMIN,
            defaults={"name": SystemRoleCode.ORG_ADMIN.label, "is_system_role": True},
        )
        user.roles.add(admin_role)
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()

    def validate_new_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def validate(self, attrs):
        try:
            user_id = urlsafe_base64_decode(attrs["uid"]).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError) as exc:
            raise domain_exceptions.ValidationError("Enlace de recuperación inválido.") from exc

        if not default_token_generator.check_token(user, attrs["token"]):
            raise domain_exceptions.ValidationError("Enlace de recuperación inválido o expirado.")

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user: User = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


def build_password_reset_link(user: User) -> tuple[str, str]:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return uid, token
