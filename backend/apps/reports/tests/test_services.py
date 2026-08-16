from datetime import date, timedelta

import pytest

from apps.reports import services
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


@pytest.fixture
def professional_user(organization, branch, system_roles, make_user):
    from apps.services.models import Employee

    user = make_user(organization, "profesional@motorsecuador.test", roles=["professional"])
    employee = Employee.objects.all_objects.create(
        organization=organization, branch=branch, user=user, first_name="Pro", last_name="Fesional"
    )
    return user, employee


class TestDashboardSummary:
    def test_admin_ve_cifras_financieras(self, organization, org_admin_user, make_appointment, employee, customer):
        make_appointment(employee=employee, customer=customer)

        summary = services.get_dashboard_summary(organization=organization, user=org_admin_user)

        assert "revenue_this_month" in summary
        assert "new_customers_this_month" in summary

    def test_profesional_no_ve_cifras_financieras_y_queda_acotado_a_sus_citas(
        self, organization, professional_user, make_appointment, employee, customer
    ):
        user, own_employee = professional_user
        make_appointment(employee=employee, customer=customer)  # de otro empleado
        make_appointment(employee=own_employee, customer=customer)

        summary = services.get_dashboard_summary(organization=organization, user=user)

        assert "revenue_this_month" not in summary
        assert summary["today_total"] == 1  # solo la cita propia


class TestChartData:
    def test_metric_invalida_lanza_validation_error(self, organization, org_admin_user):
        with pytest.raises(domain_exceptions.ValidationError):
            services.get_chart_data(
                organization=organization,
                user=org_admin_user,
                metric="no-existe",
                group_by="day",
                date_from=date.today() - timedelta(days=7),
                date_to=date.today(),
            )

    def test_group_by_invalido_lanza_validation_error(self, organization, org_admin_user):
        with pytest.raises(domain_exceptions.ValidationError):
            services.get_chart_data(
                organization=organization,
                user=org_admin_user,
                metric="appointments",
                group_by="year",
                date_from=date.today() - timedelta(days=7),
                date_to=date.today(),
            )

    def test_appointments_series_agrupa_por_dia(self, organization, org_admin_user, make_appointment, employee, customer):
        make_appointment(employee=employee, customer=customer)

        data = services.get_chart_data(
            organization=organization,
            user=org_admin_user,
            metric="appointments",
            group_by="day",
            date_from=date.today() - timedelta(days=1),
            date_to=date.today(),
        )
        assert len(data) == 1
        assert data[0]["count"] == 1

    def test_revenue_vacio_sin_permiso_financiero(self, organization, professional_user):
        user, _employee = professional_user
        data = services.get_chart_data(
            organization=organization,
            user=user,
            metric="revenue",
            group_by="day",
            date_from=date.today() - timedelta(days=7),
            date_to=date.today(),
        )
        assert data == []


class TestGeneralReport:
    def test_calcula_tasa_de_cancelacion(self, organization, org_admin_user, make_appointment, employee, customer):
        make_appointment(employee=employee, customer=customer, status="cancelled")
        make_appointment(employee=employee, customer=customer, status="completed")

        report = services.get_general_report(
            organization=organization,
            user=org_admin_user,
            date_from=date.today() - timedelta(days=1),
            date_to=date.today(),
        )

        assert report["appointments"]["total"] == 2
        assert report["cancellations"]["cancelled"] == 1
        assert report["cancellations"]["rate"] == 0.5

    def test_profesional_solo_ve_su_propia_productividad(
        self, organization, professional_user, make_appointment, employee, customer
    ):
        user, own_employee = professional_user
        make_appointment(employee=employee, customer=customer, status="completed")
        make_appointment(employee=own_employee, customer=customer, status="completed")

        report = services.get_general_report(
            organization=organization, user=user, date_from=date.today() - timedelta(days=1), date_to=date.today()
        )

        assert len(report["productivity"]) == 1
        assert report["productivity"][0]["employee_id"] == str(own_employee.id)
        assert "revenue" not in report


class TestModuleReport:
    def test_modulo_inactivo_lanza_not_found(self, organization, org_admin_user):
        with pytest.raises(domain_exceptions.NotFoundError):
            services.get_module_report(
                organization=organization,
                user=org_admin_user,
                module_code="moto",
                date_from=date.today() - timedelta(days=7),
                date_to=date.today(),
            )

    def test_modulo_sin_reporte_lanza_validation_error(self, organization, org_admin_user):
        from apps.organizations.models import ModuleActivation, ModuleCode

        ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.MOTO)
        with pytest.raises(domain_exceptions.ValidationError):
            services.get_module_report(
                organization=organization,
                user=org_admin_user,
                module_code="no-existe",
                date_from=date.today() - timedelta(days=7),
                date_to=date.today(),
            )

    def test_reporte_de_moto_cuando_esta_activo(self, organization, org_admin_user):
        from apps.organizations.models import ModuleActivation, ModuleCode

        ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.MOTO)

        report = services.get_module_report(
            organization=organization,
            user=org_admin_user,
            module_code="moto",
            date_from=date.today() - timedelta(days=7),
            date_to=date.today(),
        )
        assert "work_orders" in report
        assert "revenue" in report  # admin tiene reports:financial
