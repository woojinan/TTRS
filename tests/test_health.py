from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_serves_entry_screen() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert 'id="entry-login"' in response.text
    assert 'id="entry-register"' in response.text
    assert 'id="guest-enter"' in response.text


def test_game_assets_are_served() -> None:
    for path in ("js/engine.js", "js/audio.js", "js/skins.js", "js/app.js", "css/style.css"):
        response = client.get(f"/static/{path}")
        assert response.status_code == 200
        assert len(response.content) > 100


def test_missing_assets_return_404() -> None:
    assert client.get("/static/js/missing.js").status_code == 404


def test_settings_page_and_shared_preferences() -> None:
    response = client.get("/settings")
    assert response.status_code == 200
    for field in ("das", "arr", "ghostOpacity", "gridOpacity", "boardTheme", "skin"):
        assert f'id="pref-{field}"' in response.text
    for path in ("js/preferences.js", "js/settings.js", "css/settings.css"):
        assert client.get(f"/static/{path}").status_code == 200
    with TestClient(app) as connected:
        user = connected.get('/api/me').json()
        connected.post('/api/guest', json={}, headers={'X-CSRF-Token':user['csrf']})
        for path in ('/play', '/battle'):
            assert 'href="/settings"' in connected.get(path).text
