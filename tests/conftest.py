import pytest
from app.accounts import limits


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    # Never allow the automated API suite to write into the running production DB.
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.setenv('TTRS_DB', str(tmp_path / 'test.sqlite3'))
    limits.clear()
