from rest_framework.routers import DefaultRouter

from apps.modules.legal.views import CaseTaskViewSet, HearingViewSet, LegalCaseViewSet

router = DefaultRouter()
router.register("cases", LegalCaseViewSet, basename="legal-case")
router.register("hearings", HearingViewSet, basename="hearing")
router.register("case-tasks", CaseTaskViewSet, basename="case-task")

urlpatterns = router.urls
