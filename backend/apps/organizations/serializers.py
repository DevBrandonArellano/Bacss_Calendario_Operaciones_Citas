from rest_framework import serializers

from apps.organizations.models import ModuleActivation, Organization


class ModuleActivationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleActivation
        fields = ["id", "module_code", "is_active", "config", "activated_at", "deactivated_at"]
        read_only_fields = ["id", "activated_at", "deactivated_at"]


class OrganizationSerializer(serializers.ModelSerializer):
    modules = ModuleActivationSerializer(source="module_activations", many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "legal_name",
            "tax_id",
            "timezone",
            "default_currency",
            "date_format",
            "logo_url",
            "status",
            "settings",
            "modules",
        ]
        read_only_fields = ["id", "status"]
