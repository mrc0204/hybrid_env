"""Base model shared by every contract in this package.

Fields are written snake_case (idiomatic Python) but serialize/parse as
camelCase on the wire, matching packages/contracts (the TypeScript source of
truth) field-for-field. `populate_by_name=True` means both spellings are
accepted on input.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BaseEvent(CamelModel):
    """Mirrors packages/contracts/src/events/base.ts::BaseEvent"""

    id: str
    type: str
    timestamp: str
    source: str
    correlation_id: str | None = None
