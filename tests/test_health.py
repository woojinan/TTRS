from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_serves_both_game_modes() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert 'data-mode="sprint"' in response.text
    assert 'data-mode="attack"' in response.text
    assert 'id="result"' in response.text
    assert 'id="history-table"' in response.text


def test_game_assets_are_served() -> None:
    for path in ("js/engine.js", "js/audio.js", "js/skins.js", "js/app.js", "css/style.css"):
        response = client.get(f"/static/{path}")
        assert response.status_code == 200
        assert len(response.content) > 100


def test_missing_assets_return_404() -> None:
    assert client.get("/static/js/missing.js").status_code == 404
