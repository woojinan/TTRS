"""FastAPI application entry point."""

from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, RedirectResponse
from urllib.parse import quote
import asyncio
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.battle import BattleHub, router as battle_router
from app.accounts import router as accounts_router, COOKIE
from app.database import Database, password_hash

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

@asynccontextmanager
async def lifespan(app):
    app.state.db = Database()
    app.state.dummy_password = password_hash('not-a-real-account-password')
    hub = BattleHub(app.state.db)
    await hub.start()
    app.state.battle = hub
    try:
        yield
    finally:
        await hub.stop()


app = FastAPI(title="Tetris Battle", version="0.2.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(battle_router)
app.include_router(accounts_router)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / 'welcome.html')


async def game_page(request, filename):
    user = await asyncio.to_thread(request.app.state.db.identity, request.cookies.get(COOKIE))
    if not user or not user['entered']:
        destination = request.url.path + ('?' + request.url.query if request.url.query else '')
        return RedirectResponse('/?next=' + quote(destination, safe=''), status_code=303)
    return FileResponse(FRONTEND_DIR / filename)


@app.get('/play', include_in_schema=False)
async def solo_index(request: Request):
    return await game_page(request, 'index.html')


@app.get("/battle", include_in_schema=False)
async def battle_index(request: Request):
    return await game_page(request, 'battle.html')


@app.get("/settings", include_in_schema=False)
async def settings_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "settings.html")


@app.get('/account', include_in_schema=False)
@app.get('/rankings', include_in_schema=False)
async def account_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / 'account.html')
