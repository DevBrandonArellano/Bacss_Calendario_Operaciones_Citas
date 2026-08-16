from django.contrib import admin

from apps.modules.legal.models import CaseEvent, CaseTask, Hearing, LegalCase


@admin.register(LegalCase)
class LegalCaseAdmin(admin.ModelAdmin):
    list_display = ["case_number", "customer", "responsible_lawyer", "status", "organization"]
    list_filter = ["status", "priority"]
    search_fields = ["case_number"]


admin.site.register(CaseEvent)
admin.site.register(Hearing)
admin.site.register(CaseTask)
