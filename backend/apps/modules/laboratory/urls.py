from rest_framework.routers import DefaultRouter

from apps.modules.laboratory.views import (
    LabOrderViewSet,
    LabResultViewSet,
    LabTestViewSet,
    PatientViewSet,
    SampleViewSet,
)

router = DefaultRouter()
router.register("patients", PatientViewSet, basename="patient")
router.register("lab-orders", LabOrderViewSet, basename="lab-order")
router.register("lab-tests", LabTestViewSet, basename="lab-test")
router.register("samples", SampleViewSet, basename="sample")
router.register("lab-results", LabResultViewSet, basename="lab-result")

urlpatterns = router.urls
