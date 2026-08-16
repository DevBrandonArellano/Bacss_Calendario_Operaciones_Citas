from django.contrib import admin

from apps.modules.moto.models import Motorcycle, VehicleHistory, WorkOrder, WorkOrderItem


@admin.register(Motorcycle)
class MotorcycleAdmin(admin.ModelAdmin):
    list_display = ["plate", "brand", "model", "customer", "organization"]
    list_filter = ["brand"]
    search_fields = ["plate", "brand", "model", "vin"]


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ["id", "motorcycle", "status", "total", "organization", "received_at"]
    list_filter = ["status"]


admin.site.register(VehicleHistory)
admin.site.register(WorkOrderItem)
