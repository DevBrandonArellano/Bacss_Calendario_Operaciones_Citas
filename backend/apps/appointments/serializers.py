from rest_framework import serializers

from apps.appointments.models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    # Nombres de solo lectura para que la UI no tenga que resolverlos con listados
    # paginados aparte (la vista hace select_related, sin N+1).
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "branch",
            "branch_name",
            "customer",
            "customer_name",
            "service",
            "service_name",
            "employee",
            "employee_name",
            "appointment_date",
            "start_time",
            "end_time",
            "duration_minutes",
            "status",
            "notes",
            "price",
            "payment_status",
            "booking_channel",
        ]
        read_only_fields = [
            "id",
            "end_time",
            "duration_minutes",
            "status",
            "price",
            "payment_status",
        ]


class CreateAppointmentSerializer(serializers.Serializer):
    customer_id = serializers.UUIDField()
    service_id = serializers.UUIDField()
    employee_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    appointment_date = serializers.DateField()
    start_time = serializers.TimeField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    booking_channel = serializers.ChoiceField(
        choices=["online", "staff", "phone", "api"], required=False, default="staff"
    )
    requires_confirmation = serializers.BooleanField(required=False, default=False)


class RescheduleAppointmentSerializer(serializers.Serializer):
    appointment_date = serializers.DateField()
    start_time = serializers.TimeField()


class CancelAppointmentSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class UpdateAppointmentNotesSerializer(serializers.Serializer):
    notes = serializers.CharField(allow_blank=True, max_length=2000)
