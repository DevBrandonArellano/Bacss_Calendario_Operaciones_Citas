import pytest
from django.db import IntegrityError

from apps.organizations.models import ModuleActivation, ModuleCode, Organization

pytestmark = pytest.mark.django_db


def test_organization_has_module_active_false_by_default():
    org = Organization.objects.create(name="Motors Ecuador")

    assert org.has_module_active(ModuleCode.MOTO) is False


def test_organization_has_module_active_true_when_activated():
    org = Organization.objects.create(name="Motors Ecuador")
    ModuleActivation.objects.create(organization=org, module_code=ModuleCode.MOTO, is_active=True)

    assert org.has_module_active(ModuleCode.MOTO) is True


def test_module_activation_unique_per_organization_and_module():
    org = Organization.objects.create(name="Motors Ecuador")
    ModuleActivation.objects.create(organization=org, module_code=ModuleCode.MOTO)

    with pytest.raises(IntegrityError):
        ModuleActivation.objects.create(organization=org, module_code=ModuleCode.MOTO)


def test_deactivated_module_is_not_active():
    org = Organization.objects.create(name="Laboratorio ABC")
    ModuleActivation.objects.create(organization=org, module_code=ModuleCode.LABORATORY, is_active=False)

    assert org.has_module_active(ModuleCode.LABORATORY) is False
