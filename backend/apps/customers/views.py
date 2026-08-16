from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.customers.filters import CustomerFilter
from apps.customers.models import Customer
from apps.customers.serializers import CustomerHistorySerializer, CustomerSerializer
from core.permissions import HasPermission


class CustomerViewSet(ModelViewSet):
    serializer_class = CustomerSerializer
    queryset = Customer.objects.all()
    filterset_class = CustomerFilter
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["last_name", "first_name", "registered_at", "status"]
    ordering = ["last_name", "first_name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("customers:write")]
        return [HasPermission("customers:read")]

    def get_queryset(self):
        return Customer.objects.all()

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Búsqueda rápida por nombre, documento, teléfono o email (?q=)."""
        query = request.query_params.get("q", "").strip()
        queryset = self.filter_queryset(self.get_queryset())
        if query:
            queryset = queryset.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(document_number__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
            )
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerHistorySerializer(customer)
        return Response(serializer.data)
