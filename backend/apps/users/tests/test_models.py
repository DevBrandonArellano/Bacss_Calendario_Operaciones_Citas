import pytest

from apps.users.models import User

pytestmark = pytest.mark.django_db


def test_create_user_hashes_password(organization):
    user = User.objects.create_user(organization=organization, email="a@test.com", password="Password123!")

    assert user.password != "Password123!"
    assert user.check_password("Password123!")


def test_user_without_permission_by_default(organization):
    user = User.objects.create_user(organization=organization, email="b@test.com", password="Password123!")

    assert user.has_permission("branches:write") is False


def test_platform_superadmin_has_every_permission(organization):
    admin = User.objects.create_user(
        email="root@platform.test",
        password="Password123!",
        is_platform_superadmin=True,
        is_staff=True,
    )

    assert admin.has_permission("anything:whatever") is True


def test_user_inherits_permission_from_role(organization, system_roles):
    user = User.objects.create_user(organization=organization, email="c@test.com", password="Password123!")
    user.roles.add(system_roles["org_admin"])

    assert user.has_permission("branches:write") is True
    assert user.has_permission("users:write") is True


def test_customer_role_has_no_admin_permissions(organization, system_roles):
    user = User.objects.create_user(
        organization=organization, email="cliente@test.com", password="Password123!"
    )
    user.roles.add(system_roles["customer"])

    assert user.has_permission("branches:write") is False
    assert user.has_permission("users:write") is False
