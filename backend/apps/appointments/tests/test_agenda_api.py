from datetime import time

import pytest
from django.urls import reverse
from rest_framework import status

from apps.appointments.models import Appointment, AppointmentStatus
from apps.audit.models import AuditLog
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


def _make_appointment(organization, branch, customer, service, employee, day, start, **overrides):
    end_minutes = start.hour * 60 + start.minute + service.duration_minutes
    fields = {
        "organization": organization,
        "branch": branch,
        "customer": customer,
        "service": service,
        "employee": employee,
        "appointment_date": day,
        "start_time": start,
        "end_time": time(end_minutes // 60, end_minutes % 60),
        "duration_minutes": service.duration_minutes,
        "price": service.price,
        "status": AppointmentStatus.CONFIRMED,
    }
    fields.update(overrides)
    return Appointment.all_objects.create(**fields)


class TestAppointmentReadableNames:
    def test_la_lista_incluye_nombres_para_no_resolverlos_en_el_cliente(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        _make_appointment(organization, branch, customer, service, employee, monday, time(10, 0))

        response = auth_client.get(reverse("appointment-list"))

        item = response.data["results"][0]
        assert item["customer_name"] == "Cliente Uno"
        assert item["service_name"] == "Corte"
        assert item["employee_name"] == "Ana Prof"
        assert item["branch_name"] == "Sucursal Norte"

    def test_el_numero_de_consultas_no_crece_con_el_numero_de_citas(
        self,
        auth_client,
        organization,
        branch,
        customer,
        service,
        employee,
        monday,
        django_assert_max_num_queries,
    ):
        for hour in (9, 10, 11, 12, 13):
            _make_appointment(organization, branch, customer, service, employee, monday, time(hour, 0))

        with django_assert_max_num_queries(12):
            response = auth_client.get(reverse("appointment-list"))

        assert response.data["count"] == 5


class TestAppointmentFilters:
    def test_filtra_por_varios_estados(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        _make_appointment(organization, branch, customer, service, employee, monday, time(9, 0))
        _make_appointment(
            organization,
            branch,
            customer,
            service,
            employee,
            monday,
            time(10, 0),
            status=AppointmentStatus.CANCELLED,
        )
        _make_appointment(
            organization,
            branch,
            customer,
            service,
            employee,
            monday,
            time(11, 0),
            status=AppointmentStatus.PENDING,
        )

        response = auth_client.get(reverse("appointment-list"), {"status__in": "pending,confirmed"})

        statuses = sorted(item["status"] for item in response.data["results"])
        assert statuses == ["confirmed", "pending"]

    def test_filtra_por_servicio(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        other_service = Service.all_objects.create(
            organization=organization, name="Tinte", duration_minutes=60, price="30.00"
        )
        _make_appointment(organization, branch, customer, service, employee, monday, time(9, 0))
        _make_appointment(organization, branch, customer, other_service, employee, monday, time(11, 0))

        response = auth_client.get(reverse("appointment-list"), {"service": str(other_service.id)})

        assert [item["service_name"] for item in response.data["results"]] == ["Tinte"]

    def test_page_size_permite_cargar_un_rango_completo(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        for minute_block in range(25):
            hour, minute = divmod(8 * 60 + minute_block * 30, 60)
            _make_appointment(
                organization,
                branch,
                customer,
                service,
                employee,
                monday,
                time(hour % 24, minute),
                status=AppointmentStatus.COMPLETED,
            )

        response = auth_client.get(reverse("appointment-list"), {"page_size": 100})

        assert response.data["count"] == 25
        assert len(response.data["results"]) == 25


class TestUpdateAppointmentNotes:
    def test_actualiza_las_notas_y_deja_auditoria(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        appointment = _make_appointment(
            organization, branch, customer, service, employee, monday, time(10, 0)
        )

        response = auth_client.patch(
            reverse("appointment-notes", args=[appointment.id]),
            {"notes": "Trae su propio casco"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        appointment.refresh_from_db()
        assert appointment.notes == "Trae su propio casco"
        audit = AuditLog.all_objects.filter(entity_type="Appointment", entity_id=str(appointment.id)).latest(
            "created_at"
        )
        assert audit.changes["notes"]["to"] == "Trae su propio casco"

    def test_no_permite_editar_notas_de_una_cita_cerrada(
        self, auth_client, organization, branch, customer, service, employee, monday
    ):
        appointment = _make_appointment(
            organization,
            branch,
            customer,
            service,
            employee,
            monday,
            time(10, 0),
            status=AppointmentStatus.COMPLETED,
        )

        response = auth_client.patch(
            reverse("appointment-notes", args=[appointment.id]), {"notes": "tarde"}, format="json"
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_no_toca_citas_de_otra_organizacion(
        self, auth_client, other_organization, monday, django_db_blocker
    ):
        other_branch = Branch.all_objects.create(organization=other_organization, name="Ajena")
        other_customer = Customer.all_objects.create(
            organization=other_organization, first_name="A", last_name="B"
        )
        other_service = Service.all_objects.create(
            organization=other_organization, name="X", duration_minutes=30, price="1.00"
        )
        other_employee = Employee.all_objects.create(
            organization=other_organization, branch=other_branch, first_name="Z", last_name="Z"
        )
        foreign = _make_appointment(
            other_organization,
            other_branch,
            other_customer,
            other_service,
            other_employee,
            monday,
            time(10, 0),
        )

        response = auth_client.patch(
            reverse("appointment-notes", args=[foreign.id]), {"notes": "hack"}, format="json"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        foreign.refresh_from_db()
        assert foreign.notes == ""

    def test_requiere_permiso_de_escritura(
        self, api_client, organization, branch, customer, service, employee, monday, make_user, system_roles
    ):
        from rest_framework_simplejwt.tokens import RefreshToken

        appointment = _make_appointment(
            organization, branch, customer, service, employee, monday, time(10, 0)
        )
        client_user = make_user(organization, "cliente@test.com", roles=["customer"])
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(client_user).access_token}")

        response = api_client.patch(
            reverse("appointment-notes", args=[appointment.id]), {"notes": "x"}, format="json"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
