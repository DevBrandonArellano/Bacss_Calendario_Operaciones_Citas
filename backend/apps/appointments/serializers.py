from rest_framework import serializers

from apps.appointments.models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            "id",
            "branch",
            "customer",
            "service",
            "employee",
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
