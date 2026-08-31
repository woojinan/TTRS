from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_serves_korean_lobby() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "테트리스 배틀" in response.text

