from django.apps import AppConfig


class LaboratoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.modules.laboratory"
    label = "laboratory"

    def ready(self) -> None:
        from core.modules.registry import ModuleDefinition, register_module

        register_module(
            ModuleDefinition(
                module_code="laboratory", app_label="laboratory", url_prefix="/api/modules/laboratory/"
            )
        )
