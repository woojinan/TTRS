"""FastAPI application entry point."""

from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.battle import BattleHub, router as battle_router

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

@asynccontextmanager
async def lifespan(app):
    hub = BattleHub()
    await hub.start()
    app.state.battle = hub
    try:
        yield
    finally:
        await hub.stop()


app = FastAPI(title="Tetris Battle", version="0.2.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(battle_router)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    """Serve the sprint and time-attack game screen."""
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/battle", include_in_schema=False)
async def battle_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "battle.html")


@app.get("/settings", include_in_schema=False)
async def settings_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "settings.html")
