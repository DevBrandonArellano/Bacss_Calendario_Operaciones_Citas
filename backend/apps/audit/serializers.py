from rest_framework import serializers

from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "action",
            "entity_type",
            "entity_id",
            "changes",
            "ip_address",
            "correlation_id",
            "created_at",
        ]
        read_only_fields = fields
