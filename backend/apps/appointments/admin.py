from django.contrib import admin

from apps.appointments.models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = [
        "organization",
        "customer",
        "service",
        "employee",
        "appointment_date",
        "start_time",
        "status",
    ]
    list_filter = ["status", "booking_channel"]
    search_fields = ["customer__first_name", "customer__last_name"]
