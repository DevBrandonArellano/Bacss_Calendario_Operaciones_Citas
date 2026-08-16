"""Registro central de módulos especializados (docs/module-system.md).

Los módulos se registran aquí en vez de hardcodear la lista en el core:
agregar un módulo nuevo implica una entrada nueva, no tocar el core ni
los módulos existentes (Open/Closed a nivel de plataforma). `module_code`
debe coincidir con `apps.organizations.models.ModuleCode`.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModuleDefinition:
    module_code: str
    app_label: str
    url_prefix: str


_registry: dict[str, ModuleDefinition] = {}


def register_module(definition: ModuleDefinition) -> None:
    _registry[definition.module_code] = definition


def get_module(module_code: str) -> ModuleDefinition | None:
    return _registry.get(module_code)


def is_registered(module_code: str) -> bool:
    return module_code in _registry
