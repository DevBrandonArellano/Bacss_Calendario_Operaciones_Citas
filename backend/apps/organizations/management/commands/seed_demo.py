from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.appointments.services import CreateAppointmentRequest, CreateAppointmentUseCase
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.modules.laboratory.models import Patient
from apps.modules.laboratory.services import (
    CollectSampleRequest,
    CollectSampleUseCase,
    CreateLabOrderRequest,
    CreateLabOrderUseCase,
    LabTestSpec,
    RecordLabResultRequest,
    RecordLabResultUseCase,
    TransitionLabTestUseCase,
    ValidateLabResultUseCase,
)
from apps.modules.moto.models import Motorcycle, WorkOrderItemType
from apps.modules.moto.services import (
    AddWorkOrderItemRequest,
    AddWorkOrderItemUseCase,
    CreateWorkOrderRequest,
    CreateWorkOrderUseCase,
)
from apps.modules.legal.models import CaseTask, Hearing
from apps.modules.legal.services import CreateLegalCaseRequest, CreateLegalCaseUseCase, TransitionLegalCaseUseCase
from apps.modules.store.models import Inventory, Product, ProductLaunch, ProductVariant
from apps.modules.store.services import CreateOrderRequest, CreateOrderUseCase, OrderItemSpec, TransitionOrderUseCase
from apps.organizations.models import ModuleActivation, ModuleCode, Organization
from apps.payments.services import CreatePaymentRequest, CreatePaymentUseCase
from apps.scheduling.models import Schedule
from apps.services.models import Employee, Service
from apps.users.models import Role, User
from core.context import tenant_scope

_BUSINESS_WEEKDAYS = range(0, 5)  # lunes a viernes


def _next_monday() -> date:
    today = date.today()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


def _seed_schedules_and_appointments(*, organization, branch, employees, services, customers):
    for weekday in _BUSINESS_WEEKDAYS:
        Schedule.objects.all_objects.create(
            organization=organization,
            branch=branch,
            weekday=weekday,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        for employee in employees:
            Schedule.objects.all_objects.create(
                organization=organization,
                employee=employee,
                weekday=weekday,
                start_time=time(9, 0),
                end_time=time(18, 0),
            )

    monday = _next_monday()
    appointment_use_case = CreateAppointmentUseCase(organization=organization)
    payment_use_case = CreatePaymentUseCase(organization=organization)
    for index, (employee, customer) in enumerate(zip(employees, customers, strict=False)):
        eligible_services = employee.services.all()
        if not eligible_services:
            continue
        appointment = appointment_use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(eligible_services[0].id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(10, 0) if index == 0 else time(11, 30),
                booking_channel="staff",
            )
        )
        # Primera cita: pago completo. Segunda: pago parcial (demuestra
        # ambos estados agregados de `Appointment.payment_status`).
        payment_amount = appointment.price if index == 0 else appointment.price / 2
        payment_use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=payment_amount,
                method="cash" if index == 0 else "transfer",
            )
        )


def _seed_motorcycles_and_work_order(*, organization, customers):
    """Módulo Taller de motos (docs/roadmap.md, Fase 8): dos motos y una
    orden de trabajo de ejemplo, solo para organizaciones con el módulo
    `moto` activo (Motors Ecuador)."""

    motorcycles = [
        Motorcycle.objects.all_objects.create(
            organization=organization,
            customer=customers[0],
            plate="PBA-1234",
            brand="Yamaha",
            model="FZ 2.0",
            year=2022,
            mileage=8500,
        ),
        Motorcycle.objects.all_objects.create(
            organization=organization,
            customer=customers[1],
            plate="PBB-5678",
            brand="Honda",
            model="CB190R",
            year=2023,
            mileage=3200,
        ),
    ]

    work_order = CreateWorkOrderUseCase(organization=organization).execute(
        CreateWorkOrderRequest(
            motorcycle_id=str(motorcycles[0].id), diagnosis_notes="Revisión de frenos delanteros"
        )
    )
    AddWorkOrderItemUseCase().execute(
        work_order,
        AddWorkOrderItemRequest(
            item_type=WorkOrderItemType.PART,
            description="Pastillas de freno",
            quantity=1,
            unit_price=Decimal("15.00"),
        ),
    )
    AddWorkOrderItemUseCase().execute(
        work_order,
        AddWorkOrderItemRequest(
            item_type=WorkOrderItemType.LABOR,
            description="Mano de obra",
            quantity=1,
            unit_price=Decimal("10.00"),
        ),
    )


def _seed_lab_order(*, organization, customers):
    """Módulo Laboratorio clínico (docs/roadmap.md, Fase 9): dos pacientes
    (uno vinculado a un `Customer`, otro sin vínculo) y un pedido con dos
    pruebas — una avanzada hasta validada, otra recién solicitada — para
    mostrar el estado agregado del pedido (el cuello de botella)."""

    patients = [
        Patient.objects.all_objects.create(
            organization=organization,
            customer=customers[0],
            first_name=customers[0].first_name,
            last_name=customers[0].last_name,
            document_number=customers[0].document_number,
        ),
        Patient.objects.all_objects.create(
            organization=organization, first_name="Paciente", last_name="Sin cuenta"
        ),
    ]

    # Lecturas fuera de un caso de uso (que fija su propio contexto vía
    # `tenant_scope`, ver Fase 5/7): sin esto, `Employee.objects`/
    # `lab_order.tests` devuelven vacío (core.context.tenant_scope).
    with tenant_scope(organization.id):
        ordering_employee = Employee.objects.filter(organization=organization).first()

    lab_order = CreateLabOrderUseCase(organization=organization).execute(
        CreateLabOrderRequest(
            patient_id=str(patients[0].id),
            ordering_employee_id=str(ordering_employee.id),
            tests=[
                LabTestSpec(test_code="HEM001", test_name="Hemograma completo"),
                LabTestSpec(test_code="ORI001", test_name="Examen de orina"),
            ],
        )
    )
    with tenant_scope(organization.id):
        advanced_test, _pending_test = lab_order.tests.all()

    transition = TransitionLabTestUseCase()
    transition.execute(advanced_test, "sample_pending")
    CollectSampleUseCase().execute(advanced_test, CollectSampleRequest(sample_type="Sangre"))
    transition.execute(advanced_test, "processing")
    RecordLabResultUseCase().execute(
        advanced_test, RecordLabResultRequest(result_value="13.8", unit="g/dL", reference_range="12-16")
    )
    ValidateLabResultUseCase().execute(advanced_test)
    # La segunda prueba se deja en ORDERED a propósito: el pedido queda en
    # 'ordered' (el cuello de botella), no en 'validated'.


def _seed_store_catalog(*, organization, branch, customers):
    """Módulo Tienda / lanzamientos (docs/roadmap.md, Fase 10): dos
    productos (uno con dos variantes, otro con una), un registro de
    inventario por sucursal, un lanzamiento próximo y un pedido confirmado
    para mostrar el descuento de stock del motor de pedidos."""

    shirt = Product.objects.all_objects.create(
        organization=organization, sku="CAM-001", name="Camiseta UrbanStore", category="Ropa", price="20.00"
    )
    cap = Product.objects.all_objects.create(
        organization=organization, sku="GOR-001", name="Gorra UrbanStore", category="Accesorios", price="12.00"
    )
    shirt_variants = [
        ProductVariant.objects.all_objects.create(
            organization=organization, product=shirt, sku="CAM-001-S", attributes={"talla": "S"}, stock=15
        ),
        ProductVariant.objects.all_objects.create(
            organization=organization, product=shirt, sku="CAM-001-M", attributes={"talla": "M"}, stock=20
        ),
    ]
    cap_variant = ProductVariant.objects.all_objects.create(
        organization=organization, product=cap, sku="GOR-001-U", attributes={"talla": "única"}, stock=10
    )

    Inventory.objects.all_objects.create(
        organization=organization,
        branch=branch,
        product_variant=shirt_variants[1],
        quantity=20,
        last_counted_at=timezone.now(),
    )

    ProductLaunch.objects.all_objects.create(
        organization=organization,
        name="Colección Verano",
        launch_at=timezone.now() + timedelta(days=14),
        presale_enabled=True,
        quota=100,
        schedule_windows=[{"starts_at": "09:00", "ends_at": "12:00"}],
    ).products.set([shirt, cap])

    order = CreateOrderUseCase(organization=organization).execute(
        CreateOrderRequest(
            customer_id=str(customers[0].id),
            branch_id=str(branch.id),
            items=[
                OrderItemSpec(product_variant_id=str(shirt_variants[1].id), quantity=2),
                OrderItemSpec(product_variant_id=str(cap_variant.id), quantity=1),
            ],
        )
    )
    TransitionOrderUseCase().execute(order, "confirmed")


def _seed_legal_cases(*, organization, customers, lawyer, admin_user):
    """Módulo Legal (docs/roadmap.md, Fase 11): un caso activo con una
    audiencia programada y una tarea pendiente, y un segundo caso recién
    abierto — para mostrar la cronología automática de transiciones
    (`CaseEvent`) y el alcance sobre casos propios de un profesional."""

    active_case = CreateLegalCaseUseCase(organization=organization, actor_user=admin_user).execute(
        CreateLegalCaseRequest(
            case_number="LEG-0001",
            customer_id=str(customers[0].id),
            case_type="Civil",
            responsible_lawyer_id=str(lawyer.id),
            priority="high",
            description="Demanda por incumplimiento de contrato.",
        )
    )
    TransitionLegalCaseUseCase(actor_user=admin_user).execute(active_case, "in_review")
    TransitionLegalCaseUseCase(actor_user=admin_user).execute(active_case, "active")

    Hearing.objects.all_objects.create(
        organization=organization,
        legal_case=active_case,
        scheduled_at=timezone.now() + timedelta(days=10),
        location="Juzgado Civil No. 3",
    )
    CaseTask.objects.all_objects.create(
        organization=organization,
        legal_case=active_case,
        title="Preparar alegato de apertura",
        assigned_to_user=admin_user,
        due_date=(timezone.now() + timedelta(days=7)).date(),
        priority="high",
    )

    CreateLegalCaseUseCase(organization=organization, actor_user=admin_user).execute(
        CreateLegalCaseRequest(
            case_number="LEG-0002",
            customer_id=str(customers[1].id),
            case_type="Laboral",
            responsible_lawyer_id=str(lawyer.id),
            priority="medium",
            description="Consulta inicial, pendiente de revisión.",
        )
    )


_MOTORS_CUSTOMERS = [
    {"first_name": "Carlos", "last_name": "Andrade", "document_number": "0910111213", "phone": "0991112233"},
    {"first_name": "Lucía", "last_name": "Vega", "document_number": "0920212223", "phone": "0992223344"},
    {"first_name": "Miguel", "last_name": "Soto", "document_number": "0930313233", "phone": "0993334455"},
]

_MOTORS_SERVICES = [
    {"name": "Cambio de aceite", "category": "Mantenimiento", "duration_minutes": 30, "price": "18.00"},
    {"name": "Revisión general", "category": "Diagnóstico", "duration_minutes": 60, "price": "25.00"},
    {"name": "Cambio de llantas", "category": "Mantenimiento", "duration_minutes": 45, "price": "35.00"},
]

_MOTORS_EMPLOYEES = [
    {"first_name": "Pedro", "last_name": "Mecánico", "specialty": "Motor"},
    {"first_name": "Sofía", "last_name": "Técnica", "specialty": "Frenos y suspensión"},
]

_LABX_CUSTOMERS = [
    {"first_name": "Elena", "last_name": "Ramírez", "document_number": "0940414243", "phone": "0994445566"},
    {"first_name": "Jorge", "last_name": "Paredes", "document_number": "0950515253", "phone": "0995556677"},
]

_LABX_SERVICES = [
    {"name": "Hemograma completo", "category": "Sangre", "duration_minutes": 15, "price": "12.00"},
    {"name": "Examen de orina", "category": "Orina", "duration_minutes": 10, "price": "8.00"},
]

_LABX_EMPLOYEES = [
    {"first_name": "Andrea", "last_name": "Bioquímica", "specialty": "Análisis clínicos"},
]

_URBANSTORE_CUSTOMERS = [
    {"first_name": "Valeria", "last_name": "Cordero", "document_number": "0960616263", "phone": "0996667788"},
    {"first_name": "Diego", "last_name": "Salazar", "document_number": "0970717273", "phone": "0997778899"},
]

_LEGALXYZ_CUSTOMERS = [
    {"first_name": "Rosa", "last_name": "Salinas", "document_number": "0980818283", "phone": "0998889900"},
    {"first_name": "Iván", "last_name": "Moreno", "document_number": "0990919293", "phone": "0999990011"},
]


class Command(BaseCommand):
    """Seed de demo (esqueleto, se amplía en cada fase siguiente).

    Crea dos organizaciones de rubros distintos, como pide el criterio de
    éxito de CLAUDE.md, para poder probar aislamiento multitenant de forma
    manual: 'Motors Ecuador' (módulo moto) y 'Laboratorio ABC' (módulo
    laboratory). Todos los datos son ficticios.
    """

    help = "Crea organizaciones y usuarios demo (idempotente en RBAC, no en datos)."

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_rbac")
        admin_role = Role.objects.get(code="org_admin", is_system_role=True)

        motors, created = Organization.objects.get_or_create(
            name="Motors Ecuador", defaults={"default_currency": "USD"}
        )
        if created:
            ModuleActivation.objects.create(organization=motors, module_code=ModuleCode.MOTO)
            branch = Branch.objects.all_objects.create(organization=motors, name="Sucursal Norte")
            admin = User.objects.create_user(
                organization=motors,
                email="admin@motorsecuador.demo",
                password="Demo1234!",
                first_name="Admin",
                last_name="Motors",
            )
            admin.roles.add(admin_role)
            customers = [
                Customer.objects.all_objects.create(organization=motors, **data) for data in _MOTORS_CUSTOMERS
            ]
            services = [
                Service.objects.all_objects.create(organization=motors, **data) for data in _MOTORS_SERVICES
            ]
            employees = []
            for data in _MOTORS_EMPLOYEES:
                employee = Employee.objects.all_objects.create(organization=motors, branch=branch, **data)
                employee.services.set(services)
                employees.append(employee)
            _seed_schedules_and_appointments(
                organization=motors,
                branch=branch,
                employees=employees,
                services=services,
                customers=customers,
            )
            _seed_motorcycles_and_work_order(organization=motors, customers=customers)
            self.stdout.write(self.style.SUCCESS("Organización 'Motors Ecuador' creada."))
        else:
            self.stdout.write("Organización 'Motors Ecuador' ya existía, se omite.")

        labx, created = Organization.objects.get_or_create(
            name="Laboratorio ABC", defaults={"default_currency": "USD"}
        )
        if created:
            ModuleActivation.objects.create(organization=labx, module_code=ModuleCode.LABORATORY)
            branch = Branch.objects.all_objects.create(organization=labx, name="Sede Principal")
            admin = User.objects.create_user(
                organization=labx,
                email="admin@laboratorioabc.demo",
                password="Demo1234!",
                first_name="Admin",
                last_name="LabX",
            )
            admin.roles.add(admin_role)
            customers = [
                Customer.objects.all_objects.create(organization=labx, **data) for data in _LABX_CUSTOMERS
            ]
            services = [
                Service.objects.all_objects.create(organization=labx, **data) for data in _LABX_SERVICES
            ]
            employees = []
            for data in _LABX_EMPLOYEES:
                employee = Employee.objects.all_objects.create(organization=labx, branch=branch, **data)
                employee.services.set(services)
                employees.append(employee)
            _seed_schedules_and_appointments(
                organization=labx,
                branch=branch,
                employees=employees,
                services=services,
                customers=customers,
            )
            _seed_lab_order(organization=labx, customers=customers)
            self.stdout.write(self.style.SUCCESS("Organización 'Laboratorio ABC' creada."))
        else:
            self.stdout.write("Organización 'Laboratorio ABC' ya existía, se omite.")

        urbanstore, created = Organization.objects.get_or_create(
            name="UrbanStore", defaults={"default_currency": "USD"}
        )
        if created:
            ModuleActivation.objects.create(organization=urbanstore, module_code=ModuleCode.STORE)
            branch = Branch.objects.all_objects.create(organization=urbanstore, name="Local Centro")
            admin = User.objects.create_user(
                organization=urbanstore,
                email="admin@urbanstore.demo",
                password="Demo1234!",
                first_name="Admin",
                last_name="UrbanStore",
            )
            admin.roles.add(admin_role)
            customers = [
                Customer.objects.all_objects.create(organization=urbanstore, **data)
                for data in _URBANSTORE_CUSTOMERS
            ]
            _seed_store_catalog(organization=urbanstore, branch=branch, customers=customers)
            self.stdout.write(self.style.SUCCESS("Organización 'UrbanStore' creada."))
        else:
            self.stdout.write("Organización 'UrbanStore' ya existía, se omite.")

        legalxyz, created = Organization.objects.get_or_create(
            name="Estudio Jurídico XYZ", defaults={"default_currency": "USD"}
        )
        if created:
            ModuleActivation.objects.create(organization=legalxyz, module_code=ModuleCode.LEGAL)
            branch = Branch.objects.all_objects.create(organization=legalxyz, name="Oficina Central")
            admin = User.objects.create_user(
                organization=legalxyz,
                email="admin@estudioxyz.demo",
                password="Demo1234!",
                first_name="Admin",
                last_name="EstudioXYZ",
            )
            admin.roles.add(admin_role)
            customers = [
                Customer.objects.all_objects.create(organization=legalxyz, **data)
                for data in _LEGALXYZ_CUSTOMERS
            ]
            lawyer = Employee.objects.all_objects.create(
                organization=legalxyz, branch=branch, first_name="Marco", last_name="Abogado"
            )
            _seed_legal_cases(organization=legalxyz, customers=customers, lawyer=lawyer, admin_user=admin)
            self.stdout.write(self.style.SUCCESS("Organización 'Estudio Jurídico XYZ' creada."))
        else:
            self.stdout.write("Organización 'Estudio Jurídico XYZ' ya existía, se omite.")

        self.stdout.write(self.style.SUCCESS("Seed demo completado."))
