from rest_framework import serializers

from apps.customers.models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "branch",
            "first_name",
            "last_name",
            "full_name",
            "document_type",
            "document_number",
            "phone",
            "email",
            "address",
            "birth_date",
            "notes",
            "status",
            "registered_at",
        ]
        read_only_fields = ["id", "full_name", "registered_at"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class CustomerHistorySerializer(serializers.ModelSerializer):
    """Vista agregada del historial del cliente.

    En esta fase solo existen los datos propios del cliente; las listas de
    citas, servicios, pagos y documentos se agregan en fases posteriores
    (5, 7, 11B) sin romper este contrato.
    """

    full_name = serializers.ReadOnlyField()
    appointments = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    notes_log = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "full_name",
            "status",
            "registered_at",
            "appointments",
            "payments",
            "documents",
            "notes_log",
        ]
        read_only_fields = fields

    def get_appointments(self, obj) -> list:
        return []

    def get_payments(self, obj) -> list:
        from apps.payments.models import Payment
        from apps.payments.serializers import PaymentSerializer

        payments = Payment.objects.filter(customer=obj).select_related("appointment").order_by("-created_at")
        return PaymentSerializer(payments, many=True).data

    def get_documents(self, obj) -> list:
        return []

    def get_notes_log(self, obj) -> list:
        return []
