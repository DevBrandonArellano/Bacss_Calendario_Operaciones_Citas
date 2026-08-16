from django.contrib import admin

from apps.users.models import Permission, Role, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "is_active", "is_platform_superadmin"]
    search_fields = ["email", "first_name", "last_name"]
    list_filter = ["is_active", "is_platform_superadmin"]
    filter_horizontal = ["roles"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "organization", "is_system_role"]
    filter_horizontal = ["permissions"]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["code", "description"]
    search_fields = ["code"]
