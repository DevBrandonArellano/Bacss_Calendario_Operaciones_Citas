from django.contrib import admin

from apps.services.models import Employee, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "duration_minutes", "price", "status"]
    list_filter = ["status", "category"]
    search_fields = ["name"]


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["full_name", "organization", "branch", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["first_name", "last_name"]
    filter_horizontal = ["services"]
