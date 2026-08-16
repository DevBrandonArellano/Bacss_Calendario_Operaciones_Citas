import pytest
from django.db import IntegrityError

from apps.modules.legal.models import LegalCase

pytestmark = pytest.mark.django_db


class TestLegalCase:
    def test_case_number_unico_por_organizacion(self, organization, customer, lawyer):
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="DUP",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=lawyer,
        )
        with pytest.raises(IntegrityError):
            LegalCase.objects.all_objects.create(
                organization=organization,
                case_number="DUP",
                customer=customer,
                case_type="Civil",
                responsible_lawyer=lawyer,
            )


class TestLegalCaseTransitions:
    @pytest.mark.parametrize(
        "current,target,expected",
        [
            ("new", "in_review", True),
            ("new", "closed", True),
            ("new", "active", False),
            ("in_review", "active", True),
            ("in_review", "on_hold", False),
            ("active", "on_hold", True),
            ("on_hold", "active", True),
            ("closed", "archived", True),
            ("closed", "active", True),
            ("archived", "active", False),
        ],
    )
    def test_tabla_de_decision_transiciones(self, organization, customer, lawyer, current, target, expected):
        case = LegalCase.objects.all_objects.create(
            organization=organization,
            case_number=f"CASE-{current}-{target}",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=lawyer,
            status=current,
        )
        assert case.can_transition_to(target) is expected
