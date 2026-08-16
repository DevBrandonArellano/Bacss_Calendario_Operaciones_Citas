from rest_framework import serializers

from apps.modules.legal.models import CaseEvent, CaseTask, Hearing, LegalCase, LegalCaseStatus


class LegalCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalCase
        fields = [
            "id",
            "case_number",
            "customer",
            "case_type",
            "responsible_lawyer",
            "status",
            "opened_at",
            "closed_at",
            "priority",
            "description",
        ]
        read_only_fields = ["id", "status", "opened_at", "closed_at"]


class CreateLegalCaseSerializer(serializers.Serializer):
    case_number = serializers.CharField()
    customer_id = serializers.UUIDField()
    case_type = serializers.CharField()
    responsible_lawyer_id = serializers.UUIDField()
    priority = serializers.ChoiceField(choices=["low", "medium", "high"], default="medium")
    description = serializers.CharField(required=False, allow_blank=True, default="")


class TransitionLegalCaseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(LegalCaseStatus.values))


class CaseEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseEvent
        fields = ["id", "legal_case", "event_at", "event_type", "description", "created_by_user", "created_at"]
        read_only_fields = ["id", "legal_case", "created_by_user", "created_at"]


class HearingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hearing
        fields = ["id", "legal_case", "scheduled_at", "location", "status", "notes"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class CaseTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseTask
        fields = [
            "id",
            "legal_case",
            "title",
            "description",
            "assigned_to_user",
            "due_date",
            "priority",
            "status",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)
