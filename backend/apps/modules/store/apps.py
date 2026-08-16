from django.apps import AppConfig


class StoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.modules.store"
    label = "store"

    def ready(self) -> None:
        from core.modules.registry import ModuleDefinition, register_module

        register_module(
            ModuleDefinition(module_code="store", app_label="store", url_prefix="/api/modules/store/")
        )
