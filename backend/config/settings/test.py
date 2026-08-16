import tempfile

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key"

# Archivos subidos en tests van a un directorio temporal, nunca a mediafiles/ real.
MEDIA_ROOT = tempfile.mkdtemp(prefix="operaciones_citas_test_media_")

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

LOGGING["root"]["level"] = "WARNING"  # noqa: F405
