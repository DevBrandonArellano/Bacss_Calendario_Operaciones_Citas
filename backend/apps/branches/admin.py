from django.contrib import admin

from apps.branches.models import Branch


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]
