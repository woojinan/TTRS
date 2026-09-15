"""Same-origin cookie authentication and replay-verified personal records."""
import asyncio
import contextlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request, Response
from app.database import password_hash, password_ok, IntegrityError

router = APIRouter(prefix='/api')
COOKIE = 'ttrs_session'
limits = defaultdict(deque)
verify_slots = asyncio.Semaphore(2)
hash_slots = asyncio.Semaphore(2)


def rate(request, group, count=20, seconds=60):
    now = time.monotonic()
    key = (request.client.host if request.client else 'local', group)
    if len(limits) > 10000:
        for k in list(limits):
            if not limits[k] or limits[k][-1] < now - 600:
                del limits[k]
    q = limits[key]
    while q and q[0] < now-seconds:
        q.popleft()
    if len(q) >= count:
        raise HTTPException(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.')
    q.append(now)


def identity(request):
    user = request.app.state.db.identity(request.cookies.get(COOKIE))
    if not user:
        raise HTTPException(401, '세션이 만료되었습니다. 새로고침해 주세요.')
    return user


def mutate(request):
    origin = request.headers.get('origin')
    if origin and urlsplit(origin).netloc.lower() != request.headers.get('host', '').lower():
        raise HTTPException(403, '다른 사이트의 요청은 허용하지 않습니다.')
    user = identity(request)
    if not hmac.compare_digest(request.headers.get('x-csrf-token', ''), user['csrf']):
        raise HTTPException(403, '보안 토큰을 확인할 수 없습니다. 새로고침해 주세요.')
    return user


def cookie(response, token):
    response.set_cookie(COOKIE, token, httponly=True, samesite='strict', secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true', max_age=86400*30, path='/')
    response.headers['Cache-Control'] = 'no-store'


async def body(request, maximum=4096):
    if 'application/json' not in request.headers.get('content-type', ''):
        raise HTTPException(415, 'JSON 요청이 필요합니다.')
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > maximum:
            raise HTTPException(413, '요청 크기가 너무 큽니다.')
    try:
        value = json.loads(data)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, UnicodeError):
        raise HTTPException(400, '잘못된 요청입니다.')


@router.get('/me')
def me(request: Request, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    db = request.app.state.db
    user = db.identity(request.cookies.get(COOKIE))
    if not user:
        rate(request, 'guest', 120)
        guest = db.guest()
        token = db.session(guest['id'])
        cookie(response, token)
        user = db.identity(token)
    return user


@router.post('/register')
async def register(request: Request, response: Response):
    user = mutate(request)
    rate(request, 'auth', 10)
    m = await body(request)
    username, password, nickname = m.get('username', ''), m.get('password', ''), m.get('nickname', '')
    if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9_]{3,24}', username):
        raise HTTPException(400, '아이디는 영문·숫자·밑줄 3~24자입니다.')
    if not isinstance(password, str) or not 10 <= len(password) <= 128:
        raise HTTPException(400, '비밀번호는 10~128자입니다.')
    if not isinstance(nickname, str) or not re.fullmatch(r'[가-힣a-zA-Z0-9_]{2,16}', nickname):
        raise HTTPException(400, '닉네임은 한글·영문·숫자·밑줄 2~16자입니다.')
    async with hash_slots:
        hashed = await asyncio.to_thread(password_hash, password)
    try:
        request.app.state.db.upgrade(user['id'], username.lower(), nickname, hashed)
    except IntegrityError:
        raise HTTPException(409, '이미 사용 중인 아이디 또는 닉네임입니다.')
    except ValueError as e:
        raise HTTPException(409, str(e))
    request.app.state.db.revoke(request.cookies.get(COOKIE))
    cookie(response, request.app.state.db.session(user['id'], entered=True))
    return {'ok': True}


@router.post('/login')
async def login(request: Request, response: Response):
    mutate(request)
    rate(request, 'auth', 10)
    m = await body(request)
    if not isinstance(m.get('username'), str) or not isinstance(m.get('password'), str) or len(m['password']) > 128:
        raise HTTPException(400, '아이디와 비밀번호를 확인해 주세요.')
    user = request.app.state.db.find_user(m['username'].lower())
    async with hash_slots:
        valid = await asyncio.to_thread(password_ok, m['password'], user['password'] if user else request.app.state.dummy_password)
    if not user or not valid:
        raise HTTPException(401, '아이디 또는 비밀번호가 올바르지 않습니다.')
    request.app.state.db.revoke(request.cookies.get(COOKIE))
    cookie(response, request.app.state.db.session(user['id'], entered=True))
    return {'ok': True}


@router.post('/logout')
async def logout(request: Request, response: Response):
    mutate(request)
    request.app.state.db.revoke(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


@router.post('/guest')
def enter_guest(request: Request):
    user = mutate(request)
    request.app.state.db.enter(request.cookies.get(COOKIE), user)
    return {'ok': True}


@router.get('/records')
def records(request: Request, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return request.app.state.db.history(identity(request)['id'])


@router.get('/rankings')
def rankings(request: Request, mode: str = 'battle'):
    if mode not in ('sprint', 'attack', 'battle'):
        raise HTTPException(400, '잘못된 모드입니다.')
    return request.app.state.db.ranking(mode)


@router.post('/runs/start')
async def start_run(request: Request):
    user = mutate(request)
    if not user['entered']:
        raise HTTPException(403, '로그인하거나 게스트로 입장해 주세요.')
    rate(request, 'runs', 40)
    m = await body(request)
    if m.get('mode') not in ('sprint', 'attack'):
        raise HTTPException(400, '잘못된 모드입니다.')
    return request.app.state.db.ticket(user['id'], m['mode'])


@router.post('/runs/finish')
async def finish_run(request: Request):
    user = mutate(request)
    rate(request, 'finish', 30)
    m = await body(request, 3_000_000)
    ticket = request.app.state.db.get_ticket(str(m.get('id', '')), user['id'])
    elapsed = m.get('elapsed')
    if not ticket or type(elapsed) not in (int, float) or not 0 <= elapsed <= 3_600_000 or elapsed > (time.time()-ticket['created'])*1000 + 1000:
        raise HTTPException(400, '기록 시간 또는 실행 정보를 검증할 수 없습니다.')
    payload = json.dumps({'mode': ticket['mode'], 'seed': ticket['seed'], 'elapsed': elapsed, 'actions': m.get('actions')}).encode()
    async with verify_slots:
        proc = await asyncio.create_subprocess_exec('node', str(Path(__file__).with_name('replay.cjs')), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, **({'creationflags': subprocess.CREATE_NO_WINDOW} if sys.platform == 'win32' else {}))
        try:
            output, _ = await asyncio.wait_for(proc.communicate(payload), 8)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
            await proc.wait()
            raise HTTPException(400, '입력 기록 검증 시간이 초과됐습니다.')
    if proc.returncode:
        raise HTTPException(400, '입력 재생 검증에 실패했습니다. 로컬 기록은 유지됩니다.')
    result = json.loads(output)
    if not request.app.state.db.save_solo(ticket, result):
        raise HTTPException(409, '이미 저장한 기록입니다.')
    return {'ok': True, 'record': result}
