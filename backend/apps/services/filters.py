import django_filters

from apps.services.models import Employee, Service


class ServiceFilter(django_filters.FilterSet):
    class Meta:
        model = Service
        fields = {
            "status": ["exact"],
            "category": ["exact"],
            "branches": ["exact"],
        }


class EmployeeFilter(django_filters.FilterSet):
    class Meta:
        model = Employee
        fields = {
            "is_active": ["exact"],
            "branch": ["exact"],
            "services": ["exact"],
        }
