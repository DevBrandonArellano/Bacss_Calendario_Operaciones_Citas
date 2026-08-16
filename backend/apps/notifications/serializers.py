from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "channel",
            "event_code",
            "status",
            "subject",
            "body",
            "payload",
            "sent_at",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
