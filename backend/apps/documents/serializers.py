from rest_framework import serializers

from apps.documents.models import Document, DocumentOwnerType


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "id",
            "owner_type",
            "owner_id",
            "name",
            "file",
            "file_type",
            "size_bytes",
            "version",
            "status",
            "uploaded_by_user",
            "created_at",
        ]
        read_only_fields = ["id", "file_type", "size_bytes", "version", "uploaded_by_user", "created_at"]


class UploadDocumentSerializer(serializers.Serializer):
    owner_type = serializers.ChoiceField(choices=list(DocumentOwnerType.values))
    owner_id = serializers.UUIDField()
    name = serializers.CharField()
    file = serializers.FileField()
