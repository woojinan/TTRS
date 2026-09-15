import json
import re
import subprocess

from fastapi.testclient import TestClient
from app.main import app
from app.database import Database, password_hash, password_ok


def post(client, path, data):
    me = client.get('/api/me').json()
    if path == '/runs/start' and not me['entered']:
        client.post('/api/guest', json={}, headers={'X-CSRF-Token': me['csrf']})
    return client.post('/api'+path, json=data, headers={'X-CSRF-Token': me['csrf']})


def test_guest_unique_numeric_and_secure_cookie():
    with TestClient(app) as c:
        names = set()
        for _ in range(15):
            c.cookies.clear()
            r = c.get('/api/me')
            assert r.status_code == 200
            assert re.fullmatch(r'guest_\d{5,6}', r.json()['nickname'])
            names.add(r.json()['nickname'])
            assert 'HttpOnly' in r.headers['set-cookie']
            assert 'SameSite=strict' in r.headers['set-cookie']
        assert len(names) == 15


def test_registration_session_rotation_login_logout_and_conflict():
    with TestClient(app) as c:
        before = c.get('/api/me').json()
        token = c.cookies.get('ttrs_session')
        assert post(c, '/register', {'username':'Tester', 'nickname':'파란토끼', 'password':'test-pass-123'}).status_code == 200
        user = c.get('/api/me').json()
        assert user['id'] == before['id'] and user['username'] == 'tester'
        assert app.state.db.identity(token) is None
        assert post(c, '/logout', {}).status_code == 200
        assert post(c, '/login', {'username':'tester','password':'wrong-pass'}).status_code == 401
        assert post(c, '/register', {'username':'tester','nickname':'다른토끼','password':'test-pass-123'}).status_code == 409
        assert post(c, '/login', {'username':'TESTER','password':'test-pass-123'}).status_code == 200
        assert c.get('/api/me').json()['id'] == before['id']
        stored = app.state.db.find_user('tester')['password']
        assert stored != 'test-pass-123' and password_ok('test-pass-123', stored)


def test_csrf_origin_and_invalid_input():
    with TestClient(app) as c:
        me = c.get('/api/me').json()
        assert c.post('/api/logout',json={}).status_code == 403
        assert c.post('/api/logout',json={},headers={'X-CSRF-Token':me['csrf'],'Origin':'http://evil.invalid'}).status_code == 403
        assert post(c,'/register',{'username':'x','nickname':'토끼','password':'short'}).status_code == 400
        assert post(c,'/runs/start',{'mode':'fake'}).status_code == 400
        assert c.get('/api/rankings?mode=fake').status_code == 400


def test_replay_verified_record_rejects_forgery_ownership_and_duplicates():
    with TestClient(app) as c:
        ticket=post(c,'/runs/start',{'mode':'sprint'}).json()
        script="const {Game,seededRandom}=require('./frontend/js/engine.js');const g=new Game(seededRandom(Number(process.argv[1]))),actions=[];let t=0;while(!g.over){t++;actions.push(['hardDrop',t,[]]);g.hardDrop(t);}console.log(JSON.stringify({actions,elapsed:t,score:g.score}));"
        trace=json.loads(subprocess.check_output(['node','-e',script,str(ticket['seed'])]))
        payload={'id':ticket['id'],**trace}
        assert post(c,'/runs/finish',{'id':ticket['id'],'elapsed':1,'actions':[],'score':999999}).status_code == 400
        saved=post(c,'/runs/finish',payload)
        assert saved.status_code == 200, saved.text
        assert saved.json()['record']['score'] == trace['score']
        assert post(c,'/runs/finish',payload).status_code in (400,409)
        assert len(c.get('/api/records').json()) == 1
        assert c.get('/api/rankings?mode=sprint').json() == []  # Incomplete 40-line run.
        c.cookies.clear()
        assert post(c,'/runs/finish',payload).status_code == 400
        assert c.get('/api/records').json() == []


def test_battle_ranking_draw_and_idempotency(tmp_path):
    db=Database(tmp_path/'rank.sqlite3')
    users=[db.guest() for _ in range(3)]
    players=[{'userId':u['id'],'score':0,'lines':0,'pieces':1,'placement':i+1,'won':i==0} for i,u in enumerate(users)]
    db.save_battle('match',players,1000)
    db.save_battle('match',players,1000)
    rank=db.ranking('battle')
    assert rank[0]['wins']==1 and rank[0]['value']==2 and rank[0]['games']==1
    db.save_battle('draw',[{**p,'won':False,'placement':1} for p in players],1000)
    assert sum(p['wins'] for p in db.ranking('battle'))==1
