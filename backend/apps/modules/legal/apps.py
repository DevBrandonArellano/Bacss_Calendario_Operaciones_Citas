from django.apps import AppConfig


class LegalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.modules.legal"
    label = "legal"

    def ready(self) -> None:
        from core.modules.registry import ModuleDefinition, register_module

        register_module(
            ModuleDefinition(module_code="legal", app_label="legal", url_prefix="/api/modules/legal/")
        )
