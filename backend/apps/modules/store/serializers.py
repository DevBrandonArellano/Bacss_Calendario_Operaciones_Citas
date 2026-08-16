from rest_framework import serializers

from apps.modules.store.models import (
    Inventory,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductLaunch,
    ProductVariant,
)


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "name",
            "description",
            "category",
            "price",
            "cost",
            "stock",
            "min_stock",
            "status",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        # organization se toma SIEMPRE del usuario autenticado, nunca del body.
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["id", "product", "sku", "attributes", "stock", "price_override"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = ["id", "branch", "product_variant", "quantity", "last_counted_at"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        return super().create(validated_data)


class ProductLaunchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductLaunch
        fields = ["id", "name", "launch_at", "presale_enabled", "quota", "schedule_windows", "products"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["organization"] = self.context["request"].user.organization
        products = validated_data.pop("products", [])
        launch = super().create(validated_data)
        if products:
            launch.products.set(products)
        return launch


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product_variant", "quantity", "unit_price", "subtotal"]
        read_only_fields = ["id", "unit_price", "subtotal"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "customer", "branch", "status", "total", "ordered_at", "items"]
        read_only_fields = ["id", "status", "total", "ordered_at", "items"]


class OrderItemSpecSerializer(serializers.Serializer):
    product_variant_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class CreateOrderSerializer(serializers.Serializer):
    customer_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    items = OrderItemSpecSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("El pedido debe incluir al menos un ítem.")
        return value


class TransitionOrderSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(OrderStatus.values))
