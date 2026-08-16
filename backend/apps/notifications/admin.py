from django.contrib import admin

from apps.notifications.models import Notification, NotificationSetting, NotificationTemplate


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ["event_code", "channel", "organization", "is_active"]
    list_filter = ["channel", "is_active"]
    search_fields = ["event_code"]


@admin.register(NotificationSetting)
class NotificationSettingAdmin(admin.ModelAdmin):
    list_display = ["organization", "email_enabled", "sms_enabled", "whatsapp_enabled"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        "event_code",
        "channel",
        "status",
        "organization",
        "customer",
        "recipient_user",
        "created_at",
    ]
    list_filter = ["channel", "status"]
    search_fields = ["event_code"]
