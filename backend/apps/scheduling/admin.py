from django.contrib import admin

from apps.scheduling.models import AvailabilityBlock, Schedule


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ["organization", "branch", "employee", "weekday", "start_time", "end_time", "is_break"]
    list_filter = ["weekday", "is_break"]


@admin.register(AvailabilityBlock)
class AvailabilityBlockAdmin(admin.ModelAdmin):
    list_display = ["organization", "branch", "employee", "date", "reason"]
    list_filter = ["reason"]
