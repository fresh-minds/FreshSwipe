"""Tests for transient DB error detection helpers."""

from app.utils.db_errors import is_transient_db_error


def test_detects_azure_sql_wakeup_error():
    exc = Exception("Database 'freshswipe2' is not currently available. (40613)")
    assert is_transient_db_error(exc) is True


def test_detects_timeout_error():
    exc = Exception("pyodbc.OperationalError: [HYT00] Login timeout expired")
    assert is_transient_db_error(exc) is True


def test_ignores_non_transient_error():
    exc = Exception("IntegrityError: UNIQUE constraint failed")
    assert is_transient_db_error(exc) is False
