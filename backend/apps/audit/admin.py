from django.contrib import admin

from apps.audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "organization", "user", "action", "entity_type", "entity_id"]
    list_filter = ["action", "entity_type"]
    search_fields = ["entity_id", "correlation_id"]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
