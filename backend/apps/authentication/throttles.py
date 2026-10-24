from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle


class AuthRateThrottle(ScopedRateThrottle):
    """Rate limiting reforzado para endpoints de autenticación (docs/security-strategy.md)."""

    scope = "auth"

    def get_rate(self) -> str | None:
        # `SimpleRateThrottle.THROTTLE_RATES` es un snapshot de
        # `DEFAULT_THROTTLE_RATES` tomado al importar el módulo de DRF, no
        # se re-lee por request. Sin este override, cambiar
        # `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (p. ej. vía
        # `override_settings` en tests) no tiene ningún efecto real.
        self.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
        return super().get_rate()
