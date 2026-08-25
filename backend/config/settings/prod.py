from django.core.exceptions import ImproperlyConfigured

from decouple import Csv, config

from .base import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", cast=Csv())

# `base.py` cae a una clave insegura y pública (`insecure-dev-key-change-me`)
# si `DJANGO_SECRET_KEY` no está en el entorno, para que el desarrollo local
# nunca se rompa por esto. En producción eso es justo lo contrario de lo que
# se quiere: si la variable falta, el arranque debe fallar (config() sin
# default lanza `UndefinedValueError`) — y lo mismo si sigue teniendo el
# valor de plantilla de `.env.example` (`change-me`), que alguien puede
# copiar tal cual a un `.env` real sin darse cuenta de que sigue siendo el
# placeholder.
_KNOWN_INSECURE_SECRET_KEYS = {"insecure-dev-key-change-me", "change-me"}
SECRET_KEY = config("DJANGO_SECRET_KEY")
if SECRET_KEY in _KNOWN_INSECURE_SECRET_KEYS:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY sigue en su valor de plantilla — configúrala con un secreto real "
        "antes de desplegar con config.settings.prod."
    )

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
