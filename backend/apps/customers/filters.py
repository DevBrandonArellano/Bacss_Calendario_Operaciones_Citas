import django_filters

from apps.customers.models import Customer


class CustomerFilter(django_filters.FilterSet):
    class Meta:
        model = Customer
        fields = {
            "status": ["exact"],
            "branch": ["exact"],
        }
