from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["customer", "appointment", "amount", "method", "status", "organization", "paid_at"]
    list_filter = ["method", "status"]
    search_fields = ["customer__first_name", "customer__last_name"]
