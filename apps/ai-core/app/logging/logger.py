"""Process-wide logging setup — the Python-side counterpart to the Backend's
pino logger. Standard library logging is enough at this scale; no need for a
structured-logging dependency yet.
"""

import logging
import sys

from app.config.settings import get_settings

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return

    level = getattr(logging, get_settings().log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
