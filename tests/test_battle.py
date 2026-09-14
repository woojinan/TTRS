from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect
from app.main import app


def until(ws, kind, predicate=lambda m: True):
    for _ in range(200):
        message = ws.receive_json()
        if message["type"] == kind and predicate(message):
            return message
    raise AssertionError(f"Did not receive {kind}")


def test_websocket_rooms_chat_ready_and_leave():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/battle") as a, client.websocket_connect("/ws/battle") as b:
            aid = until(a, "hello")["id"]
            bid = until(b, "hello")["id"]
            a.send_json({"type": "create", "name": "가", "title": "테스트 방"})
            code = until(a, "joined")["code"]
            b.send_json({"type": "join", "name": "나", "code": code})
            until(b, "joined")
            assert len(until(a, "room", lambda m: len(m["players"]) == 2)["players"]) == 2
            a.send_json({"type": "chat", "text": "안녕하세요 <script>"})
            assert until(b, "chat")["text"] == "안녕하세요 <script>"
            a.send_json({"type": "ready", "ready": True})
            b.send_json({"type": "ready", "ready": True})
            state = until(a, "state", lambda m: m["phase"] == "countdown")
            assert state["phase"] == "countdown"
            assert state["players"][0]["queue"] == state["players"][1]["queue"]
            b.send_json({"type": "leave"})
            result = until(a, "room", lambda m: m["phase"] == "finished")["result"]
            assert result["winner"] == aid
            assert result["winner"] != bid
            assert result["reason"] == "leave"
        process = app.state.battle.process
    assert process.returncode is not None


def test_disconnect_and_rejoin_handover():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/battle") as a:
            aid = until(a, "hello")["id"]
            a.send_json({"type": "create"})
            code = until(a, "joined")["code"]
            with client.websocket_connect("/ws/battle") as b:
                until(b, "hello")
                b.send_json({"type": "join", "code": code})
                until(b, "joined")
                a.send_json({"type": "ready", "ready": True})
                b.send_json({"type": "ready", "ready": True})
                until(a, "state", lambda m: m["phase"] == "countdown")
            result = until(a, "room", lambda m: m.get("result") is not None)["result"]
            assert result["winner"] == aid
            assert result["reason"] == "disconnect"
            with client.websocket_connect("/ws/battle") as c:
                until(c, "hello")
                c.send_json({"type": "join", "code": code})
                assert until(c, "joined")["code"] == code


def test_origin_payload_validation_and_online_assets():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/battle", headers={"origin": "http://another-host"}):
                pass
        with client.websocket_connect("/ws/battle", headers={"origin": "http://testserver"}) as a:
            until(a, "hello")
            a.send_text('not json')
            with pytest.raises(WebSocketDisconnect):
                while True:
                    a.receive_json()
        with client.websocket_connect("/ws/battle") as a:
            until(a, "hello")
            a.send_text('x' * 4097)
            with pytest.raises(WebSocketDisconnect):
                while True:
                    a.receive_json()
        for path in ("/battle", "/static/js/battle.js", "/static/css/battle.css"):
            assert client.get(path).status_code == 200
