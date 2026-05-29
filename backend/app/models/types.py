"""Type compatibility for SQLite and PostgreSQL."""

from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB


# Use JSON for both SQLite and PostgreSQL
JSONType = JSON

# For UUID, use String in SQLite or PG_UUID in PostgreSQL
def UUIDType():
    """Return appropriate UUID type based on database dialect."""
    # We'll use String for simplicity in development
    return String(36)
