from rest_framework import serializers

from apps.branches.models import Branch


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "address", "phone", "timezone_override", "is_active"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)
