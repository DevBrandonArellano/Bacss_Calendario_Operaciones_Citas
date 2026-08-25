from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractBaseUser
from django.db import models

from apps.users.managers import UserManager
from core.models import TimeStampedModel


class SystemRoleCode(models.TextChoices):
    PLATFORM_SUPERADMIN = "superadmin", "Superadministrador de plataforma"
    ORG_ADMIN = "org_admin", "Administrador de empresa"
    RECEPTION = "reception", "Recepción"
    PROFESSIONAL = "professional", "Profesional / empleado"
    CUSTOMER = "customer", "Cliente"


class Permission(models.Model):
    """Catálogo de permisos `recurso:accion` (ver docs/auth-rbac.md)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.code


class Role(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
        help_text="null si es un rol de sistema, compartido por todas las organizaciones.",
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    is_system_role = models.BooleanField(default=False)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="unique_role_code_per_organization")
        ]

    def __str__(self) -> str:
        return self.name


class User(AbstractBaseUser, TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
        help_text="null solo para el superadministrador de plataforma.",
    )
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_platform_superadmin = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    roles = models.ManyToManyField(Role, related_name="users", blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def has_permission(self, code: str) -> bool:
        if self.is_platform_superadmin:
            return True
        return Role.objects.filter(users=self, permissions__code=code).exists()

    def has_role(self, role_code: str) -> bool:
        return self.roles.filter(code=role_code).exists()

    # Compatibilidad con el admin de Django (no usamos el sistema de
    # permisos de contrib.auth, sino el RBAC propio de `has_permission`).
    def has_perm(self, perm, obj=None) -> bool:
        return self.is_platform_superadmin

    def has_module_perms(self, app_label) -> bool:
        return self.is_platform_superadmin
