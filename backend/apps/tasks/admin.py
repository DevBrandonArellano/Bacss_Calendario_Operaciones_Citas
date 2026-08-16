from django.contrib import admin

from apps.tasks.models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["title", "owner_type", "status", "priority", "due_date", "organization"]
    list_filter = ["owner_type", "status", "priority"]
    search_fields = ["title"]
