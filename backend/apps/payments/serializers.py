from rest_framework import serializers

from apps.payments.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    appointment_date = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "appointment",
            "appointment_date",
            "customer",
            "customer_name",
            "amount",
            "method",
            "status",
            "paid_at",
            "refunded_at",
            "notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "paid_at",
            "refunded_at",
            "created_at",
            "customer_name",
            "appointment_date",
        ]

    def get_appointment_date(self, obj) -> str | None:
        return obj.appointment.appointment_date if obj.appointment_id else None


class CreatePaymentSerializer(serializers.Serializer):
    customer_id = serializers.UUIDField()
    appointment_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    method = serializers.ChoiceField(choices=["cash", "transfer", "card", "other"])
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RefundPaymentSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
