from __future__ import annotations

from django.http import HttpRequest, HttpResponse

from core.context import (
    new_correlation_id,
    set_correlation_id,
    tenant_scope,
)

CORRELATION_ID_HEADER = "X-Request-Id"


class CorrelationIdMiddleware:
    """Genera (o propaga) un correlation-id por request y lo agrega a la respuesta."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get(CORRELATION_ID_HEADER)
        correlation_id = incoming if incoming else new_correlation_id()
        set_correlation_id(correlation_id)
        request.correlation_id = correlation_id

        response = self.get_response(request)
        response[CORRELATION_ID_HEADER] = correlation_id
        return response


class CurrentOrganizationMiddleware:
    """Resuelve la organización del usuario autenticado y la fija en el contexto.

    Regla crítica: el tenant se resuelve SIEMPRE del usuario autenticado,
    nunca de un header, query param o campo del body enviado por el
    cliente.

    Nota técnica: DRF autentica el request (JWT) dentro de su propio ciclo
    de `dispatch`, posterior a los middlewares de Django — por eso, para
    rutas de API, este middleware intenta autenticar el JWT él mismo (sin
    mutar `request.user`, que sigue resolviéndose normalmente vía sesión
    para el admin de Django). Si no hay JWT válido, se apoya en
    `request.user` (sesión) como fallback, típico del admin.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        organization_id = self._resolve_organization_id(request)
        # Usa `tenant_scope` (no un `set` suelto) para que el contexto se
        # restaure al valor anterior siempre al salir, incluso si la vista
        # lanza una excepción — de lo contrario el tenant de una request
        # queda fijado en el `ContextVar` y se filtra a lo próximo que
        # corra en el mismo hilo (p. ej. el siguiente test en la misma
        # suite, que no pasa por este middleware).
        with tenant_scope(organization_id):
            return self.get_response(request)

    @staticmethod
    def _resolve_organization_id(request: HttpRequest) -> str | None:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        try:
            auth_result = JWTAuthentication().authenticate(request)
        except (InvalidToken, TokenError):
            auth_result = None

        if auth_result is not None:
            user, _token = auth_result
            return getattr(user, "organization_id", None)

        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return getattr(user, "organization_id", None)
        return None
