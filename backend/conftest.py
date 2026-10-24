import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.users.models import Role, User


@pytest.fixture(autouse=True)
def _clear_cache():
    """El cache (Redis, `CACHES` en `config/settings/base.py`) no se resetea
    solo entre tests como sí lo hace la DB (pytest-django hace rollback por
    test). Sin esto, el contador de `ScopedRateThrottle` (scope `auth`) se
    acumula a lo largo de toda la suite y tests que corren después de varios
    intentos de login empiezan a recibir 429 en vez del status que esperan.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def organization(db) -> Organization:
    return Organization.objects.create(name="Motors Ecuador")


@pytest.fixture
def other_organization(db) -> Organization:
    return Organization.objects.create(name="Laboratorio ABC")


def _make_user(organization, email, roles=(), **extra):
    user = User.objects.create_user(organization=organization, email=email, password="Password123!", **extra)
    if roles:
        role_objs = Role.objects.filter(code__in=roles)
        user.roles.set(role_objs)
    return user


@pytest.fixture
def make_user(db):
    return _make_user


@pytest.fixture
def system_roles(db):
    """Crea el catálogo de permisos y roles de sistema (equivalente a `seed_rbac`)."""
    from django.core.management import call_command

    call_command("seed_rbac")
    return {role.code: role for role in Role.objects.filter(is_system_role=True)}


@pytest.fixture
def org_admin_user(organization, system_roles):
    return _make_user(organization, "admin@motorsecuador.test", roles=["org_admin"])


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def auth_client(api_client, org_admin_user) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken

    token = RefreshToken.for_user(org_admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client
