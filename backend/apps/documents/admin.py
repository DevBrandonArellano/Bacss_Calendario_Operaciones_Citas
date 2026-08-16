from django.contrib import admin

from apps.documents.models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["name", "owner_type", "owner_id", "status", "organization", "created_at"]
    list_filter = ["owner_type", "status"]
    search_fields = ["name"]
