from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import Permission, Role, SystemRoleCode
from apps.users.permissions_catalog import PERMISSIONS, ROLE_PERMISSIONS


class Command(BaseCommand):
    help = "Crea el catálogo de permisos y los roles de sistema (idempotente)."

    @transaction.atomic
    def handle(self, *args, **options):
        for code, description in PERMISSIONS:
            Permission.objects.update_or_create(code=code, defaults={"description": description})
        self.stdout.write(self.style.SUCCESS(f"{len(PERMISSIONS)} permisos sincronizados."))

        for role_code in SystemRoleCode.values:
            role, _created = Role.objects.get_or_create(
                organization=None,
                code=role_code,
                defaults={"name": SystemRoleCode(role_code).label, "is_system_role": True},
            )
            perm_codes = ROLE_PERMISSIONS.get(role_code, [])
            permissions = Permission.objects.filter(code__in=perm_codes)
            role.permissions.set(permissions)

        self.stdout.write(self.style.SUCCESS("Roles de sistema sincronizados."))
