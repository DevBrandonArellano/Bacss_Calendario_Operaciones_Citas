import pytest

from apps.modules.legal.models import CaseEvent, LegalCaseStatus
from apps.modules.legal.services import (
    CreateLegalCaseRequest,
    CreateLegalCaseUseCase,
    TransitionLegalCaseUseCase,
)
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestCreateLegalCase:
    def test_crea_caso_y_evento_de_apertura(self, organization, customer, lawyer):
        use_case = CreateLegalCaseUseCase(organization=organization)
        case = use_case.execute(
            CreateLegalCaseRequest(
                case_number="CASE-100",
                customer_id=str(customer.id),
                case_type="Laboral",
                responsible_lawyer_id=str(lawyer.id),
            )
        )
        assert case.status == LegalCaseStatus.NEW
        events = CaseEvent.all_objects.filter(legal_case=case)
        assert events.count() == 1
        assert events.first().event_type == "case_opened"

    def test_cliente_inexistente_lanza_not_found(self, organization, lawyer):
        use_case = CreateLegalCaseUseCase(organization=organization)
        with pytest.raises(domain_exceptions.NotFoundError):
            use_case.execute(
                CreateLegalCaseRequest(
                    case_number="CASE-101",
                    customer_id="00000000-0000-0000-0000-000000000000",
                    case_type="Civil",
                    responsible_lawyer_id=str(lawyer.id),
                )
            )


class TestTransitionLegalCase:
    def test_transicion_valida_agrega_evento_y_audita(self, organization, legal_case):
        use_case = TransitionLegalCaseUseCase()
        use_case.execute(legal_case, "in_review")

        legal_case.refresh_from_db()
        assert legal_case.status == "in_review"
        events = CaseEvent.all_objects.filter(legal_case=legal_case, event_type="status_change")
        assert events.count() == 1

    def test_cerrar_fija_closed_at(self, organization, legal_case):
        TransitionLegalCaseUseCase().execute(legal_case, "closed")
        legal_case.refresh_from_db()
        assert legal_case.closed_at is not None

    def test_reabrir_desde_closed_limpia_closed_at(self, organization, legal_case):
        TransitionLegalCaseUseCase().execute(legal_case, "closed")
        TransitionLegalCaseUseCase().execute(legal_case, "active")
        legal_case.refresh_from_db()
        assert legal_case.status == "active"
        assert legal_case.closed_at is None

    def test_transicion_invalida_lanza_conflict_error(self, organization, legal_case):
        with pytest.raises(domain_exceptions.ConflictError):
            TransitionLegalCaseUseCase().execute(legal_case, "archived")
