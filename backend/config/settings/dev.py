from .base import *  # noqa: F403

DEBUG = True

LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["app"]["level"] = "DEBUG"  # noqa: F405
