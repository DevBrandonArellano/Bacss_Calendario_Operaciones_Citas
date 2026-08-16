"""Tests de `core.context.tenant_scope` (hallazgo previo a Fase 7: los
casos de uso deben fijar su propio contexto de tenant, ver
`apps/appointments/tests/test_tenant_context_regression.py`)."""

import pytest

from core.context import get_current_organization_id, set_current_organization_id, tenant_scope


class TestTenantScope:
    def test_fija_el_organization_id_dentro_del_bloque(self):
        assert get_current_organization_id() is None
        with tenant_scope("org-1"):
            assert get_current_organization_id() == "org-1"
        assert get_current_organization_id() is None

    def test_restaura_el_valor_anterior_al_salir(self):
        set_current_organization_id("org-outer")
        try:
            with tenant_scope("org-inner"):
                assert get_current_organization_id() == "org-inner"
            assert get_current_organization_id() == "org-outer"
        finally:
            set_current_organization_id(None)

    def test_restaura_incluso_si_el_bloque_lanza_excepcion(self):
        with pytest.raises(ValueError, match="boom"):
            with tenant_scope("org-1"):
                raise ValueError("boom")
        assert get_current_organization_id() is None

    def test_none_limpia_el_contexto(self):
        set_current_organization_id("org-1")
        try:
            with tenant_scope(None):
                assert get_current_organization_id() is None
        finally:
            set_current_organization_id(None)

    def test_contextos_anidados_restauran_en_orden(self):
        with tenant_scope("org-outer"):
            with tenant_scope("org-inner"):
                assert get_current_organization_id() == "org-inner"
            assert get_current_organization_id() == "org-outer"
        assert get_current_organization_id() is None
