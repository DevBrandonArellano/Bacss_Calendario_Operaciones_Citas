from rest_framework.throttling import ScopedRateThrottle


class AuthRateThrottle(ScopedRateThrottle):
    """Rate limiting reforzado para endpoints de autenticación (docs/security-strategy.md)."""

    scope = "auth"
