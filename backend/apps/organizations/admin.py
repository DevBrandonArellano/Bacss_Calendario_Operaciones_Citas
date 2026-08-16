from django.contrib import admin

from apps.organizations.models import ModuleActivation, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "status", "default_currency", "created_at"]
    search_fields = ["name", "legal_name", "tax_id"]


@admin.register(ModuleActivation)
class ModuleActivationAdmin(admin.ModelAdmin):
    list_display = ["organization", "module_code", "is_active"]
    list_filter = ["module_code", "is_active"]
