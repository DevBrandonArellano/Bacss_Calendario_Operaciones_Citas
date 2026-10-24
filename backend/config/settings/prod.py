from decouple import Csv, config

from .base import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", cast=Csv())

# Fail-fast: en base.py estas variables tienen defaults inseguros pensados
# solo para desarrollo local ("insecure-dev-key-change-me", contraseña de DB
# adivinable). Sin default aquí, decouple lanza UndefinedValueError y el
# proceso no arranca si se olvidó configurarlas — mejor que producción quede
# corriendo en silencio con credenciales públicas y predecibles.
SECRET_KEY = config("DJANGO_SECRET_KEY")
DATABASES["default"]["PASSWORD"] = config("DB_PASSWORD")  # noqa: F405

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
