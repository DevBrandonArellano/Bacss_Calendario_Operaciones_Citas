from datetime import time

import pytest
from django.core import mail

from apps.appointments.services import CreateAppointmentRequest, CreateAppointmentUseCase
from apps.notifications.models import Notification, NotificationChannel

pytestmark = pytest.mark.django_db


class TestAppointmentEventHandlers:
    def test_cita_creada_y_confirmada_notifica_al_profesional_y_al_cliente(
        self, organization, branch, service, employee, employee_user, customer, monday
    ):
        use_case = CreateAppointmentUseCase(organization=organization)
        appointment = use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(14, 0),
            )
        )

        internal_notifications = Notification.all_objects.filter(
            recipient_user=employee_user, channel=NotificationChannel.INTERNAL
        )
        # requires_confirmation=False -> nace CONFIRMED: se emiten
        # "appointment.created" y "appointment.confirmed".
        assert internal_notifications.count() == 2
        assert set(internal_notifications.values_list("event_code", flat=True)) == {
            "appointment.created",
            "appointment.confirmed",
        }

        assert len(mail.outbox) == 2
        assert all(mail.outbox[i].to == [customer.email] for i in range(2))
        assert appointment.status == "confirmed"

    def test_sin_email_de_cliente_no_intenta_enviar_correo(
        self, organization, branch, service, employee, employee_user, customer, monday
    ):
        customer.email = ""
        customer.save(update_fields=["email"])

        use_case = CreateAppointmentUseCase(organization=organization)
        use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(15, 0),
            )
        )

        assert len(mail.outbox) == 0
        assert Notification.all_objects.filter(recipient_user=employee_user).exists()
