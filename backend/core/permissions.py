from __future__ import annotations

from django.http import Http404
from rest_framework.permissions import BasePermission


class HasPermission(BasePermission):
    """Permission class parametrizable: exige un código `recurso:accion`.

    Uso: `permission_classes = [HasPermission("customers:write")]`.
    Delega en `User.has_permission(code)` (apps/users/models.py), que
    resuelve los permisos efectivos vía los roles del usuario.
    """

    def __init__(self, code: str | None = None):
        self.code = code

    def __call__(self):
        # DRF instancia `permission_classes` sin argumentos; este patrón
        # permite usar `HasPermission("x:y")` como fábrica en las vistas.
        return self

    def has_permission(self, request, view) -> bool:
        code = self.code or getattr(view, "required_permission", None)
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, "is_platform_superadmin", False):
            return True
        if code is None:
            return True
        return user.has_permission(code)


class ModuleActiveRequired(BasePermission):
    """Exige que `module_code` esté activo para la organización del usuario.

    Uso: `permission_classes = [ModuleActiveRequired("moto"), HasPermission(...)]`.
    Si el módulo no está activo, lanza `Http404` en vez de devolver `False`
    (que produciría 403): el estándar del sistema de módulos
    (docs/module-system.md) es no revelar a una organización sin el
    módulo que este existe. El exception handler global
    (`core.exception_handler`) ya traduce `Http404` a la respuesta 404
    con el formato de error uniforme.
    """

    def __init__(self, module_code: str | None = None):
        self.module_code = module_code

    def __call__(self):
        return self

    def has_permission(self, request, view) -> bool:
        module_code = self.module_code or getattr(view, "required_module", None)
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, "is_platform_superadmin", False):
            return True
        if module_code is None:
            return True
        organization = getattr(user, "organization", None)
        if organization is None or not organization.has_module_active(module_code):
            raise Http404()
        return True


class IsPlatformSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_platform_superadmin", False))
