from rest_framework import serializers

from apps.scheduling.models import AvailabilityBlock, Schedule


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = ["id", "branch", "employee", "weekday", "start_time", "end_time", "is_break"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        branch = attrs.get("branch")
        employee = attrs.get("employee")
        if not branch and not employee:
            raise serializers.ValidationError("Debe indicar una sucursal, un empleado, o ambos.")
        if attrs.get("start_time") and attrs.get("end_time") and attrs["start_time"] >= attrs["end_time"]:
            raise serializers.ValidationError("La hora de inicio debe ser anterior a la de fin.")
        return attrs

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class AvailabilityBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityBlock
        fields = ["id", "employee", "branch", "date", "start_time", "end_time", "reason", "notes"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if attrs.get("start_time") and attrs.get("end_time") and attrs["start_time"] >= attrs["end_time"]:
            raise serializers.ValidationError("La hora de inicio debe ser anterior a la de fin.")
        return attrs

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class AvailabilityQuerySerializer(serializers.Serializer):
    service_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    date = serializers.DateField()
    employee_id = serializers.UUIDField(required=False, allow_null=True)


class AvailabilitySlotSerializer(serializers.Serializer):
    employee_id = serializers.UUIDField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
