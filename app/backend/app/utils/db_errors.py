"""Helpers for handling transient database connectivity failures."""
from __future__ import annotations


def is_transient_db_error(exc: Exception) -> bool:
    """Return True when an error looks like a temporary DB availability issue."""
    message = str(exc)
    transient_markers = (
        "Database '",  # Azure SQL 40613 usually includes this with "not currently available"
        "not currently available",
        "(40613)",
        "HYT00",
        "08S01",
        "Login timeout expired",
        "TCP Provider: Error code 0x68",
    )
    return any(marker in message for marker in transient_markers)
