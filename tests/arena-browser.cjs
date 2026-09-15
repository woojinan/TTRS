/* Two independent browser sessions, real sockets and real gameplay input. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{setTimeout:delay}=require('node:timers/promises');
const {Game,cells}=require('../frontend/js/engine.js');
const out=path.resolve('.test-artifacts'),base=process.env.TTRS_URL||'http://127.0.0.1:1559';
fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'duel-browser-'));
const proc=spawn(process.env.TTRS_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--disable-popup-blocking','--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'],{windowsHide:true,stdio:'ignore'});
const errors=[],connections=[];let browser,port,passed=0;
async function until(fn,timeout=7000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await fn())return;await delay(40);}throw Error('Condition timeout');}
class CDP {
  constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.messages=[];this.state=null;
    this.opened=new Promise((yes,no)=>{this.ws.onopen=yes;this.ws.onerror=no;});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(m.error.message)):p.yes(m.result);}}else{
      if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
      if(m.method==='Network.responseReceived'&&m.params.response.status>=400)errors.push(m.params.response.url);
      if(m.method==='Network.webSocketFrameReceived'){const raw=m.params.response.payloadData;try{const data=JSON.parse(raw);this.messages.push(data);if(data.type==='state')this.state=data;if(data.type==='hello')this.id=data.id;}catch{}}
    }};connections.push(this);
  }
  async send(method,params={}){await this.opened;return new Promise((yes,no)=>{const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);no(Error(`CDP timeout: ${method}`));},15000);this.pending.set(id,{yes,no,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async click(selector){await this.send('Page.bringToFront');await this.eval('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});}
  async drag(selector,dx,dy){await this.send('Page.bringToFront');const r=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...r});for(let i=1;i<=5;i++)await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:r.x+dx*i/5,y:r.y+dy*i/5});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:r.x+dx,y:r.y+dy});}
  async key(code,key=code){const windowsVirtualKeyCode={Enter:13,Escape:27,Space:32}[code];await this.send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode,text:code==='Enter'?'\r':undefined});await this.send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode});}
  async fill(selector,value){await this.eval(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);}
  self(){return this.state?.players.find(p=>p.id===this.id);}
  async shot(name){const m=await this.send('Page.getLayoutMetrics');const {width,height}=m.cssContentSize;const r=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));}
}
async function page(route='/battle'){const {browserContextId}=await browser.send('Target.createBrowserContext');const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId});const {targetInfos}=await browser.send('Target.getTargets');assert.ok(targetInfos.some(t=>t.targetId===targetId));const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const p=new CDP(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);p.context=browserContextId;
  await p.send('Runtime.enable');await p.send('Page.enable');await p.send('Network.enable');await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:base+(route==='/'?'/play':route)});await until(()=>p.eval(`document.readyState==='complete'`));if(route.startsWith('/?')){await until(()=>p.eval(`Boolean(document.querySelector('#guest-enter'))&&!document.querySelector('#guest-enter').disabled`));return p;}if(await p.eval(`Boolean(document.querySelector('#guest-enter'))`)){await until(()=>p.eval(`!document.querySelector('#guest-enter').disabled`));await p.click('#guest-enter');}await until(()=>p.eval(route==='/battle'?`document.body?.dataset.connected==='true'`:`typeof TTRSAccount!=='undefined'&&document.readyState==='complete'`));return p;
}
async function check(name,fn){await fn();console.log(`PASS ${++passed}: ${name}`);}
async function fits(page,label){const d=await page.eval(`(()=>{const w=document.documentElement.clientWidth;return{width:w,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>w+1).map(e=>e.id||e.className||e.tagName).slice(0,20)};})()`);assert.ok(d.scroll<=d.width,`${label}: ${JSON.stringify(d)}`);}

(async()=>{let a,b,c,solo,account;try{
  const file=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(file),15000);const lines=fs.readFileSync(file,'utf8').trim().split('\n');port=lines[0];browser=new CDP('ws://127.0.0.1:'+port+lines[1]);
  a=await page();b=await page();c=await page();solo=await page('/');
  await check('guest identities, keyboard-only play and 5 next pieces',async()=>{
    const names=await Promise.all([a,b,c].map(p=>p.eval("document.querySelector('#nickname').value")));assert.equal(new Set(names).size,3);names.forEach(n=>assert.match(n,/^guest_\d{5,6}$/));
    for(const p of [a,solo])assert.equal(await p.eval("document.querySelectorAll('[data-action],[data-control],.duel-touch,.mobile-controls').length"),0);
    assert.equal(await a.eval("document.querySelectorAll('#duel-next canvas').length"),5);
  });
  await check('3 independent browsers join a room; everyone ready then host starts',async()=>{
    await a.click('#create-room');await until(()=>a.messages.some(m=>m.type==='joined'));const code=a.messages.find(m=>m.type==='joined').code;
    for(const p of [b,c]){await p.fill('#join-code',code);await p.click('#join-room');}
    await until(()=>a.state?.total===3);assert.equal(await a.eval("document.querySelectorAll('#opponent-boards canvas').length"),2);
    assert.equal(await a.eval("document.querySelector('#ready-button').hidden"),true);assert.equal(await a.eval("document.querySelector('#start-match').disabled"),true);await b.click('#ready-button');
    await until(()=>a.eval("!document.querySelector('#start-match').disabled"));await a.click('#start-match');await until(()=>a.state?.phase==='playing'&&c.state?.phase==='playing',7000);
    assert.deepEqual(a.self().queue,b.self().queue);
  });
  await check('emoji picker inserts and sends to all peers safely',async()=>{
    await a.click('#emoji-toggle');await a.click('#emoji-picker button[aria-label="파란 하트"]');assert.equal(await a.eval("document.querySelector('#chat-input').value"),'💙');await a.click('#chat-send');
    await until(()=>c.eval("document.querySelector('#chat-messages').textContent.includes('💙')"));await delay(550);
    await a.fill('#chat-input','<img src=x onerror=alert(1)>');await a.click('#chat-send');await until(()=>b.eval("document.querySelector('#chat-messages').textContent.includes('<img')"));assert.equal(await b.eval("document.querySelectorAll('#chat-messages img').length"),0);
  });
  await check('board and chat resizing applies live and survives reload',async()=>{
    assert.equal(await a.eval("document.querySelectorAll('.layout-controls').length"),0);
    assert.equal(await a.eval("document.querySelector('#self-board').getBoundingClientRect().width"),300);
    await a.drag('[data-resize=board-right]',60,0);await a.drag('[data-resize=chat-corner]',60,150);
    const sizes=await a.eval("({board:document.querySelector('#self-board').getBoundingClientRect().width,chat:document.querySelector('#chat-messages').getBoundingClientRect().height,rail:document.querySelector('.duel-sidebar').getBoundingClientRect().width})");assert.deepEqual(sizes,{board:360,chat:450,rail:360});
    const before=a.self().pieces;await a.eval("document.activeElement.blur()");await a.key('Space',' ');await until(()=>a.self().pieces>before);
    await a.shot('arena-three-players.png');
  });
  await check('all other mini boards have no grid and remain visible after elimination',async()=>{
    const pixels=await a.eval("(()=>{const c=document.querySelector('#opponent-boards canvas'),g=c.getContext('2d');return [Array.from(g.getImageData(0,150,1,1).data),Array.from(g.getImageData(5,155,1,1).data),c.getBoundingClientRect().width];})()");
    assert.deepEqual(pixels[0],pixels[1]);assert.ok(pixels[2]<100);
    await c.click('#forfeit-button');await c.click('#confirm-exit');await until(()=>c.self()?.eliminated);
    assert.equal(a.state.phase,'playing');assert.equal(await a.eval("document.querySelectorAll('#opponent-boards canvas').length"),2);
    await b.click('#forfeit-button');await b.click('#confirm-exit');await until(()=>a.state?.phase==='finished');
    assert.equal(a.state.result.winner,a.id);assert.equal(a.state.result.standings.length,3);
    await until(()=>a.eval("TTRSAccount.api('/records').then(r=>r.some(x=>x.mode==='battle'&&x.participants===3))"));
  });
  await check('solo real keyboard run is replay-verified into PostgreSQL',async()=>{
    await solo.click('#start-button');await until(()=>solo.eval("phase==='playing'"),6000);
    for(let i=0;i<25&&await solo.eval("phase==='playing'");i++){await solo.key('Space',' ');await delay(65);}
    await until(()=>solo.eval("phase==='finished'"));await until(()=>solo.eval("document.querySelector('#server-record-status').textContent.includes('서버 저장 완료')"),10000);
    assert.ok(await solo.eval("TTRSAccount.api('/records').then(r=>r.some(x=>x.mode==='sprint'&&x.pieces>0))"));
    await solo.shot('solo-server-record.png');
  });
  await check('registration, logout, login and ranking UI',async()=>{
    account=await page('/account');await until(()=>account.eval("TTRSAccount.user!==null"));
    const suffix=String(Date.now()).slice(-9);await account.fill('#register-username','browser'+suffix);await account.fill('#register-nickname','파란토끼'+suffix);await account.fill('#register-password','preview-only-password-123');await account.click('#register-form button');
    await until(()=>account.eval("document.querySelector('#auth-forms').hidden"));
    await account.click('#logout-button');await until(()=>account.eval("!document.querySelector('#auth-forms').hidden"));
    await account.fill('#login-username','browser'+suffix);await account.fill('#login-password','preview-only-password-123');await account.click('#login-form button');await until(()=>account.eval("document.querySelector('#auth-forms').hidden"));
    assert.ok(await account.eval("document.querySelectorAll('#ranking-body tr').length")>=1);await account.shot('accounts-rankings.png');
  });
  await check('desktop and compact viewport layouts do not overflow',async()=>{
    for(const p of [a,solo,account])for(const width of [390,768,1440]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await fits(p,'width '+width);}
    await a.send('Page.reload',{ignoreCache:true});await until(()=>a.eval("document.body?.dataset.connected==='true'"));await until(()=>a.eval("getComputedStyle(document.documentElement).getPropertyValue('--play-width').trim()==='360px'"));
  });
  assert.deepEqual(errors,[]);console.log('PASS all '+passed+' arena browser scenarios, no runtime or HTTP errors');
}catch(e){console.error(e);console.error('Browser errors:',errors);if(a)await a.shot('arena-failure.png').catch(()=>{});process.exitCode=1;}
finally{for(const p of connections)p.ws.close();proc.kill();}
})();
