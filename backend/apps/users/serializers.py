from django.db.models import Q
from rest_framework import serializers

from apps.users.models import Role, User


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name", "is_system_role"]
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "full_name",
            "is_active",
            "roles",
        ]
        read_only_fields = ["id", "full_name", "roles"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=10)
    role_codes = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "password", "role_codes"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        role_codes = validated_data.pop("role_codes", [])
        password = validated_data.pop("password")
        organization = self.context["request"].user.organization
        user = User.objects.create_user(organization=organization, password=password, **validated_data)
        if role_codes:
            assignable = Q(organization=organization) | Q(organization__isnull=True, is_system_role=True)
            roles = Role.objects.filter(assignable, code__in=role_codes)
            user.roles.set(roles)
        return user
