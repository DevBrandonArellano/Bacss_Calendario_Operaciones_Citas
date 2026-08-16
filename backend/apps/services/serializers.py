from rest_framework import serializers

from apps.services.models import Employee, Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "category", "duration_minutes", "price", "status", "branches"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "branch",
            "first_name",
            "last_name",
            "full_name",
            "specialty",
            "is_active",
            "services",
        ]
        read_only_fields = ["id", "full_name"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class EmployeeServiceAssignmentSerializer(serializers.Serializer):
    service_ids = serializers.ListField(child=serializers.UUIDField())

    def save(self, **kwargs):
        employee: Employee = self.context["employee"]
        organization = self.context["request"].user.organization
        services = Service.objects.filter(
            organization=organization, id__in=self.validated_data["service_ids"]
        )
        employee.services.set(services)
        return employee
