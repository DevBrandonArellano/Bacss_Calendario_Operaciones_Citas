"""Búsqueda global (docs/roadmap.md, Fase 11B): agrega resultados de
varios recursos en una sola respuesta, filtrada por módulos activos y por
permiso del usuario en cada tipo — nunca se consulta un recurso para el
que el usuario no tiene `:read`, ni de un módulo inactivo para su
organización. Deliberadamente no busca en `Patient`/`LabResult` (dato
clínico sensible, fuera del alcance pedido para la búsqueda global).
"""

from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

MIN_QUERY_LENGTH = 2
MAX_RESULTS_PER_TYPE = 10


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < MIN_QUERY_LENGTH:
            return Response({"results": []})

        user = request.user
        organization = user.organization
        results: list[dict] = []

        if user.has_permission("customers:read"):
            results += self._search_customers(query)
        if user.has_permission("appointments:read"):
            results += self._search_appointments(query)
        if organization.has_module_active("moto") and user.has_permission("moto:read"):
            results += self._search_motorcycles(query)
        if organization.has_module_active("legal") and user.has_permission("legal:read"):
            results += self._search_legal_cases(query, user)
        if organization.has_module_active("store") and user.has_permission("store:read"):
            results += self._search_orders(query)
        results += self._search_documents(query, user, organization)

        return Response({"results": results})

    def _search_customers(self, query: str) -> list[dict]:
        from apps.customers.models import Customer

        matches = Customer.objects.filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(document_number__icontains=query)
            | Q(phone__icontains=query)
            | Q(email__icontains=query)
        )[:MAX_RESULTS_PER_TYPE]
        return [
            {"type": "customer", "id": str(c.id), "label": c.full_name, "detail": c.document_number}
            for c in matches
        ]

    def _search_appointments(self, query: str) -> list[dict]:
        from apps.appointments.models import Appointment

        matches = Appointment.objects.select_related("customer").filter(
            Q(notes__icontains=query)
            | Q(customer__first_name__icontains=query)
            | Q(customer__last_name__icontains=query)
        )[:MAX_RESULTS_PER_TYPE]
        return [
            {
                "type": "appointment",
                "id": str(a.id),
                "label": f"Cita {a.appointment_date} · {a.customer.full_name}",
                "detail": a.status,
            }
            for a in matches
        ]

    def _search_motorcycles(self, query: str) -> list[dict]:
        from apps.modules.moto.models import Motorcycle

        matches = Motorcycle.objects.filter(
            Q(plate__icontains=query) | Q(brand__icontains=query) | Q(model__icontains=query)
        )[:MAX_RESULTS_PER_TYPE]
        return [
            {"type": "motorcycle", "id": str(m.id), "label": f"{m.plate} · {m.brand} {m.model}", "detail": ""}
            for m in matches
        ]

    def _search_legal_cases(self, query: str, user) -> list[dict]:
        from apps.modules.legal.models import LegalCase
        from apps.modules.legal.views import can_read_all_cases

        qs = LegalCase.objects.filter(
            Q(case_number__icontains=query) | Q(case_type__icontains=query) | Q(description__icontains=query)
        )
        if not can_read_all_cases(user):
            employee = getattr(user, "employee_profile", None)
            qs = qs.filter(responsible_lawyer=employee) if employee else qs.none()
        matches = qs[:MAX_RESULTS_PER_TYPE]
        return [
            {"type": "legal_case", "id": str(c.id), "label": f"{c.case_number} · {c.case_type}", "detail": c.status}
            for c in matches
        ]

    def _search_orders(self, query: str) -> list[dict]:
        from apps.modules.store.models import Order

        matches = Order.objects.select_related("customer").filter(
            Q(customer__first_name__icontains=query) | Q(customer__last_name__icontains=query)
        )[:MAX_RESULTS_PER_TYPE]
        return [
            {
                "type": "order",
                "id": str(o.id),
                "label": f"Pedido {o.customer.full_name} · {o.total}",
                "detail": o.status,
            }
            for o in matches
        ]

    def _search_documents(self, query: str, user, organization) -> list[dict]:
        from apps.documents.models import Document
        from core.owner_access import OWNER_TYPE_PERMISSIONS

        readable_owner_types = [
            owner_type
            for owner_type, (read_code, _write_code) in OWNER_TYPE_PERMISSIONS.items()
            if owner_type != "patient" and user.has_permission(read_code)
        ]
        module_by_owner_type = {"case": "legal", "work_order": "moto", "order": "store"}
        readable_owner_types = [
            owner_type
            for owner_type in readable_owner_types
            if owner_type not in module_by_owner_type or organization.has_module_active(module_by_owner_type[owner_type])
        ]
        if not readable_owner_types:
            return []

        matches = Document.objects.filter(owner_type__in=readable_owner_types, name__icontains=query)[
            :MAX_RESULTS_PER_TYPE
        ]
        return [
            {"type": "document", "id": str(d.id), "label": d.name, "detail": d.owner_type} for d in matches
        ]
