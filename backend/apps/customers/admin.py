from django.contrib import admin

from apps.customers.models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["full_name", "organization", "document_number", "phone", "status"]
    list_filter = ["status"]
    search_fields = ["first_name", "last_name", "document_number", "phone", "email"]
