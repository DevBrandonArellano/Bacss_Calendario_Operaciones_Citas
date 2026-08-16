from django.contrib import admin

from apps.modules.laboratory.models import LabOrder, LabResult, LabTest, Patient, Sample


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ["full_name", "document_number", "organization"]
    search_fields = ["first_name", "last_name", "document_number"]


@admin.register(LabOrder)
class LabOrderAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "status", "organization", "ordered_at"]
    list_filter = ["status"]


admin.site.register(LabTest)
admin.site.register(Sample)
admin.site.register(LabResult)
