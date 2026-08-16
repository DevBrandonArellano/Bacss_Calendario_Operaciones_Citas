from django.contrib import admin

from apps.modules.store.models import Inventory, Order, OrderItem, Product, ProductLaunch, ProductVariant


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["sku", "name", "price", "stock", "status", "organization"]
    list_filter = ["status", "category"]
    search_fields = ["sku", "name"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "customer", "status", "total", "organization", "ordered_at"]
    list_filter = ["status"]


admin.site.register(ProductVariant)
admin.site.register(Inventory)
admin.site.register(ProductLaunch)
admin.site.register(OrderItem)
