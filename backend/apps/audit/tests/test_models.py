import pytest

from apps.audit.models import AuditAction, AuditLog
from apps.audit.services import log_action

pytestmark = pytest.mark.django_db


def test_log_action_creates_entry(organization, org_admin_user):
    entry = log_action(
        action=AuditAction.LOGIN,
        entity_type="User",
        entity_id=str(org_admin_user.id),
        organization=organization,
        user=org_admin_user,
    )

    assert AuditLog.objects.filter(id=entry.id).exists()


def test_audit_log_cannot_be_updated(organization, org_admin_user):
    entry = log_action(
        action=AuditAction.LOGIN, entity_type="User", organization=organization, user=org_admin_user
    )

    entry.entity_type = "Tampered"
    with pytest.raises(PermissionError):
        entry.save()


def test_audit_log_cannot_be_deleted(organization, org_admin_user):
    entry = log_action(
        action=AuditAction.LOGIN, entity_type="User", organization=organization, user=org_admin_user
    )

    with pytest.raises(PermissionError):
        entry.delete()


def test_audit_log_queryset_update_and_delete_are_blocked(organization, org_admin_user):
    log_action(action=AuditAction.LOGIN, entity_type="User", organization=organization, user=org_admin_user)

    with pytest.raises(PermissionError):
        AuditLog.objects.all().update(entity_type="Tampered")

    with pytest.raises(PermissionError):
        AuditLog.objects.all().delete()
