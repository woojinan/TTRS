from fastapi.testclient import TestClient
from app.main import app
import pytest
from starlette.websockets import WebSocketDisconnect


def test_explicit_entry_gate_and_invite_redirect():
    with TestClient(app) as c:
        assert c.get('/battle?room=ABCDEF',follow_redirects=False).headers['location']=='/?next=%2Fbattle%3Froom%3DABCDEF'
        me=c.get('/api/me').json()
        assert not me['entered']
        with pytest.raises(WebSocketDisconnect):
            with c.websocket_connect('/ws/battle'):pass
        headers={'X-CSRF-Token':me['csrf']}
        assert c.post('/api/runs/start',json={'mode':'sprint'},headers=headers).status_code==403
        assert c.post('/api/guest',json={},headers=headers).status_code==200
        assert c.get('/api/me').json()['entered']
        assert 'id="board"' in c.get('/play').text
        assert 'id="create-room"' in c.get('/battle').text
        assert c.post('/api/logout',json={},headers=headers).status_code==200
        assert c.get('/play',follow_redirects=False).status_code==303


def test_legacy_guest_renamed_without_losing_user_id_or_records():
    with TestClient(app) as c:
        me=c.get('/api/me').json()
        with app.state.db.connect() as db:
            db.execute('UPDATE users SET nickname=? WHERE id=?',('포근한토끼',me['id']))
        assert c.post('/api/guest',json={},headers={'X-CSRF-Token':me['csrf']}).status_code==200
        new=c.get('/api/me').json()
        assert new['id']==me['id'] and new['nickname'].startswith('guest_')
