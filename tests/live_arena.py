"""Destructive-to-test-records smoke test: run ONLY against the preview Compose project."""
import asyncio
import json
import os
import time

import httpx
from websockets.asyncio.client import connect


async def main():
    assert os.getenv('TTRS_ALLOW_LOAD_TEST') == 'true', 'Explicit preview opt-in required'
    base=os.getenv('TTRS_TEST_URL','http://127.0.0.1:1558')
    clients=[]
    async def participant():
        client=httpx.AsyncClient(base_url=base,timeout=20)
        user=(await client.get('/api/me')).json()
        assert (await client.post('/api/guest',json={},headers={'X-CSRF-Token':user['csrf']})).status_code==200
        ws=await connect(base.replace('http','ws',1)+'/ws/battle',additional_headers={'Cookie':'ttrs_session='+client.cookies.get('ttrs_session')})
        p={'client':client,'ws':ws,'user':user,'events':[],'state':None,'bytes':0,'frames':0,'rtt':[]}
        async def receive():
            async for raw in ws:
                m=json.loads(raw);p['bytes']+=len(raw);p['events'].append(m);p['events']=p['events'][-250:]
                if m['type']=='hello':p['id']=m['id']
                if m['type']=='state':p['state']=m;p['frames']+=1
                if m['type']=='pong':p['rtt'].append((time.monotonic()-m['at'])*1000)
        p['reader']=asyncio.create_task(receive());clients.append(p)
        return p
    async def send(p,**m):await p['ws'].send(json.dumps(m))
    async def until(fn,seconds=15):
        end=time.monotonic()+seconds
        while time.monotonic()<end:
            if fn():return
            await asyncio.sleep(.03)
        raise AssertionError('Live condition timed out')
    async def heartbeat():
        while True:
            for p in list(clients):
                if not p['reader'].done():await send(p,type='ping',at=time.monotonic())
            await asyncio.sleep(3)
    heart=asyncio.create_task(heartbeat())
    try:
        for _ in range(51):await participant()
        await until(lambda:all('id' in p for p in clients))
        assert len({p['user']['nickname'] for p in clients})==51
        host=clients[0];await send(host,type='create',title='자동 검증 50인 방')
        await until(lambda:any(m['type']=='joined' for m in host['events']))
        code=next(m['code'] for m in host['events'] if m['type']=='joined')
        for p in clients[1:50]:await send(p,type='join',code=code)
        await until(lambda:host['state'] and host['state']['total']==50)
        await send(clients[50],type='join',code=code)
        await until(lambda:any(m['type']=='error' and '50' in m['message'] for m in clients[50]['events']))
        for p in clients[:50]:await send(p,type='ready',ready=True)
        await until(lambda:any(m['type']=='room' and len(m['players'])==50 and any(v['ready'] for v in m['players'] if v['id']!=m['host']) for m in host['events']))
        await send(host,type='start')
        await until(lambda:all(p['state'] and p['state']['phase']=='playing' for p in clients[:50]))
        for p in clients[:50]:
            assert len(p['state']['players'])==1 and len(p['state']['roster'])==50
            assert all(len(v['mini'])==200 for v in p['state']['roster'])
        await send(host,type='chat',text='모두 반가워요 💙 🐰')
        await until(lambda:all(any(m['type']=='chat' and '💙' in m['text'] for m in p['events']) for p in clients[:50]))
        baseline=sum(p['bytes'] for p in clients);started=time.monotonic()
        for seq in range(1,31):
            for p in clients[:50]:await send(p,type='input',match=p['state']['match'],seq=seq,action='rotate-180' if seq%3==0 else 'left' if seq%2 else 'right',edge='tap')
            await asyncio.sleep(.25)
        duration=time.monotonic()-started
        assert all(not p['reader'].done() for p in clients[:50])
        assert all(p['frames']>=50 for p in clients[:50])
        traffic=(sum(p['bytes'] for p in clients)-baseline)/duration/1024/1024
        for p in clients[1:50]:await send(p,type='forfeit')
        await until(lambda:host['state']['phase']=='finished')
        result=host['state']['result'];assert result['winner']==host['id'] and len(result['standings'])==50
        history=(await host['client'].get('/api/records')).json()
        assert history[0]['placement']==1 and history[0]['participants']==50
        ranks=(await host['client'].get('/api/rankings?mode=battle')).json()
        assert any(r['nickname']==host['user']['nickname'] and r['wins']>=1 for r in ranks)
        # Exercise PostgreSQL login/unique constraint and server replay endpoints too.
        h={'X-CSRF-Token':host['user']['csrf']};suffix=str(int(time.time()))
        response=await host['client'].post('/api/register',headers=h,json={'username':'live'+suffix,'nickname':'검증토끼'+suffix,'password':'preview-only-password-123'})
        assert response.status_code==200,response.text
        guest=clients[50];duplicate=await guest['client'].post('/api/register',headers={'X-CSRF-Token':guest['user']['csrf']},json={'username':'live'+suffix,'nickname':'다른토끼','password':'preview-only-password-123'})
        assert duplicate.status_code==409,duplicate.text
        assert (await guest['client'].get('/api/me')).status_code==200
        rtt=[v for p in clients for v in p['rtt']]
        print(json.dumps({'passed':True,'clients':50,'all_boards':50,'frames_min':min(p['frames'] for p in clients[:50]),'aggregate_MiB_s':round(traffic,2),'ping_max_ms':round(max(rtt),1),'stored_players':50,'postgres_registration':True},ensure_ascii=False))
    finally:
        heart.cancel()
        for p in clients:
            await p['ws'].close();p['reader'].cancel();await p['client'].aclose()


if __name__=='__main__':asyncio.run(main())
