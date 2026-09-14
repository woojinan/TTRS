"""WebSocket transport for the shared JavaScript game engine (one server worker)."""
import asyncio
import contextlib
import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class BattleHub:
    def __init__(self):
        self.clients = {}
        self.process = None
        self.reader = None
        self.write_lock = asyncio.Lock()

    async def start(self):
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Online battle requires Node.js 22 or later on PATH.")
        self.process = await asyncio.create_subprocess_exec(
            node, str(Path(__file__).with_suffix(".cjs")),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            limit=256 * 1024,
            **({"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}),
        )
        self.reader = asyncio.create_task(self.read())

    async def emit(self, op, client, message=None):
        async with self.write_lock:
            if self.process.returncode is not None:
                raise ConnectionError("Battle engine stopped")
            payload = json.dumps({"op": op, "id": client, "message": message}) + "\n"
            self.process.stdin.write(payload.encode())
            await self.process.stdin.drain()

    async def read(self):
        try:
            while line := await self.process.stdout.readline():
                event = json.loads(line)
                queue = self.clients.get(event["client"])
                if queue is not None:
                    if queue.full():
                        # Disconnect a slow consumer instead of blocking every room.
                        while not queue.empty():
                            queue.get_nowait()
                        queue.put_nowait({"type": "expired"})
                    else:
                        queue.put_nowait(event["message"])
        finally:
            for queue in list(self.clients.values()):
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait({"type": "server_closed"})

    async def stop(self):
        if self.process:
            if self.process.returncode is None:
                self.process.stdin.close()
                try:
                    await asyncio.wait_for(self.process.wait(), 3)
                except asyncio.TimeoutError:
                    self.process.terminate()
                    await self.process.wait()
            if self.reader:
                await self.reader


@router.websocket("/ws/battle")
async def battle_socket(socket: WebSocket):
    # Same-host pages, including LAN/public IP URLs, may open the socket.
    origin = socket.headers.get("origin")
    if origin and urlsplit(origin).netloc.lower() != socket.headers.get("host", "").lower():
        await socket.close(code=1008)
        return
    hub = socket.app.state.battle
    if hub.process.returncode is not None or len(hub.clients) >= 256:
        await socket.close(code=1013)
        return
    await socket.accept()
    client = uuid.uuid4().hex
    queue = asyncio.Queue(maxsize=64)
    hub.clients[client] = queue

    async def writer():
        while True:
            message = await queue.get()
            await socket.send_json(message)
            if message["type"] in ("expired", "server_closed"):
                await socket.close(code=1012)
                return

    output = asyncio.create_task(writer())
    try:
        await hub.emit("connect", client)
        while True:
            raw = await asyncio.wait_for(socket.receive_text(), 25)
            if len(raw) > 4096:
                await socket.close(code=1009)
                break
            try:
                message = json.loads(raw)
            except ValueError:
                await socket.close(code=1008)
                break
            if not isinstance(message, dict):
                await socket.close(code=1008)
                break
            await hub.emit("message", client, message)
    except (WebSocketDisconnect, asyncio.TimeoutError, ConnectionError, RuntimeError):
        pass
    finally:
        hub.clients.pop(client, None)
        output.cancel()
        with contextlib.suppress(asyncio.CancelledError, RuntimeError, WebSocketDisconnect):
            await output
        with contextlib.suppress(ConnectionError, BrokenPipeError):
            await hub.emit("disconnect", client)
