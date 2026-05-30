"""Session schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    label: str | None = None


class SessionResponse(BaseModel):
    id: str
    token: str
    label: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
