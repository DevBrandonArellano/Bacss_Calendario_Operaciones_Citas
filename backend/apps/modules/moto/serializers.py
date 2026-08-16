from rest_framework import serializers

from apps.modules.moto.models import (
    Motorcycle,
    VehicleHistory,
    WorkOrder,
    WorkOrderItem,
    WorkOrderItemType,
    WorkOrderStatus,
)


class MotorcycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Motorcycle
        fields = [
            "id",
            "customer",
            "plate",
            "brand",
            "model",
            "year",
            "color",
            "vin",
            "engine_number",
            "mileage",
            "purchase_date",
            "notes",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class VehicleHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleHistory
        fields = [
            "id",
            "motorcycle",
            "service_date",
            "mileage",
            "service_description",
            "diagnosis",
            "parts_used",
            "labor_description",
            "technician",
            "cost",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "motorcycle", "created_at"]


class WorkOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkOrderItem
        fields = ["id", "item_type", "description", "quantity", "unit_price", "subtotal"]
        read_only_fields = ["id", "subtotal"]


class WorkOrderSerializer(serializers.ModelSerializer):
    items = WorkOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "motorcycle",
            "appointment",
            "status",
            "total",
            "diagnosis_notes",
            "received_at",
            "delivered_at",
            "items",
        ]
        read_only_fields = ["id", "status", "total", "received_at", "delivered_at", "items"]


class CreateWorkOrderSerializer(serializers.Serializer):
    motorcycle_id = serializers.UUIDField()
    appointment_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    diagnosis_notes = serializers.CharField(required=False, allow_blank=True, default="")


class TransitionWorkOrderSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(WorkOrderStatus.values))


class AddWorkOrderItemSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=list(WorkOrderItemType.values))
    description = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
