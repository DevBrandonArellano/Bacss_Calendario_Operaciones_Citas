from rest_framework import serializers

from apps.tasks.models import Task, TaskOwnerType


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "owner_type",
            "owner_id",
            "title",
            "description",
            "assigned_to_user",
            "due_date",
            "priority",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "owner_type", "owner_id", "created_at"]


class CreateTaskSerializer(serializers.Serializer):
    owner_type = serializers.ChoiceField(choices=list(TaskOwnerType.values))
    owner_id = serializers.UUIDField()
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True, default="")
    assigned_to_user_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    priority = serializers.ChoiceField(choices=["low", "medium", "high"], default="medium")
