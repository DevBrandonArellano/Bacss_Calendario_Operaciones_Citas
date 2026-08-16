from rest_framework import serializers

from apps.modules.laboratory.models import LabOrder, LabResult, LabTest, Patient, Sample


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "id",
            "customer",
            "first_name",
            "last_name",
            "document_number",
            "birth_date",
            "sex",
            "medical_notes",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class SampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sample
        fields = ["id", "sample_type", "collected_at", "collected_by_employee", "status"]
        read_only_fields = fields


class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = [
            "id",
            "lab_test",
            "result_value",
            "unit",
            "reference_range",
            "observations",
            "validated_by_employee",
            "validated_at",
        ]
        read_only_fields = fields


class LabResultRefSerializer(serializers.ModelSerializer):
    """Referencia sin los valores clínicos: `LabTestSerializer` es visible
    con el permiso general `laboratory:read`, pero el contenido de
    `LabResult` (dato sensible) exige el permiso granular
    `lab_results:read` y su acceso queda auditado (docs/erd.md,
    docs/auth-rbac.md) — por eso no se anida completo aquí. El cliente
    que tenga el permiso pide el detalle vía `GET /lab-results/{id}/`.
    """

    class Meta:
        model = LabResult
        fields = ["id"]
        read_only_fields = fields


class LabTestSerializer(serializers.ModelSerializer):
    sample = SampleSerializer(read_only=True)
    result = LabResultRefSerializer(read_only=True)

    class Meta:
        model = LabTest
        fields = ["id", "lab_order", "test_code", "test_name", "status", "sample", "result"]
        read_only_fields = fields


class LabOrderSerializer(serializers.ModelSerializer):
    tests = LabTestSerializer(many=True, read_only=True)

    class Meta:
        model = LabOrder
        fields = ["id", "patient", "ordering_employee", "status", "ordered_at", "tests"]
        read_only_fields = ["id", "status", "ordered_at", "tests"]


class LabTestSpecSerializer(serializers.Serializer):
    test_code = serializers.CharField()
    test_name = serializers.CharField()


class CreateLabOrderSerializer(serializers.Serializer):
    patient_id = serializers.UUIDField()
    ordering_employee_id = serializers.UUIDField()
    tests = LabTestSpecSerializer(many=True)

    def validate_tests(self, value):
        if not value:
            raise serializers.ValidationError("El pedido debe incluir al menos una prueba.")
        return value


class TransitionLabTestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["sample_pending", "sample_taken", "processing", "delivered"])


class CollectSampleSerializer(serializers.Serializer):
    sample_type = serializers.CharField()
    collected_by_employee_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class RecordLabResultSerializer(serializers.Serializer):
    result_value = serializers.CharField()
    unit = serializers.CharField(required=False, allow_blank=True, default="")
    reference_range = serializers.CharField(required=False, allow_blank=True, default="")
    observations = serializers.CharField(required=False, allow_blank=True, default="")
