from django.apps import AppConfig


class MotoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.modules.moto"
    label = "moto"

    def ready(self) -> None:
        from core.modules.registry import ModuleDefinition, register_module

        register_module(
            ModuleDefinition(module_code="moto", app_label="moto", url_prefix="/api/modules/moto/")
        )
