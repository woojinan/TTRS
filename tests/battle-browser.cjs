/* Two independent browser sessions, real sockets and real gameplay input. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{setTimeout:delay}=require('node:timers/promises');
const {Game,cells}=require('../frontend/js/engine.js');
const out=path.resolve('.test-artifacts'),base=process.env.TTRS_URL||'http://127.0.0.1:1558';
fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'duel-browser-'));
const proc=spawn(process.env.TTRS_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'],{windowsHide:true,stdio:'ignore'});
const errors=[],connections=[];let browser,passed=0;
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
  async click(selector){const r=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});}
  async key(code,key=code){const windowsVirtualKeyCode={Enter:13,Escape:27,Space:32}[code];await this.send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode,text:code==='Enter'?'\r':undefined});await this.send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode});}
  async fill(selector,value){await this.eval(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);}
  self(){return this.state?.players.find(p=>p.id===this.id);}
  async shot(name){const m=await this.send('Page.getLayoutMetrics');const {width,height}=m.cssContentSize;const r=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));}
}
async function page(route='/battle'){const {browserContextId}=await browser.send('Target.createBrowserContext');const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId});const {targetInfos}=await browser.send('Target.getTargets');assert.ok(targetInfos.some(t=>t.targetId===targetId));const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const p=new CDP(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);p.context=browserContextId;
  await p.send('Runtime.enable');await p.send('Page.enable');await p.send('Network.enable');await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:base+route});await until(()=>p.eval(route==='/battle'?`document.body.dataset.connected==='true'`:`typeof drawPreviews==='function'&&document.readyState==='complete'`));return p;
}
async function check(name,fn){await fn();console.log(`PASS ${++passed}: ${name}`);}
async function fits(page,label){const d=await page.eval(`(()=>{const w=document.documentElement.clientWidth;return{width:w,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>w+1).map(e=>e.id||e.className||e.tagName).slice(0,20)};})()`);assert.ok(d.scroll<=d.width,`${label}: ${JSON.stringify(d)}`);}
// Heuristic placements use the shared engine only to plan. All actual moves travel
// through keyboard events, the browser WebSocket and the server simulation.
function plan(p){let best=null;for(let turns=0;turns<4;turns++){
  const g=new Game();g.board=structuredClone(p.board);g.current=structuredClone(p.current);for(let i=0;i<turns;i++)g.rotate(1,0);
  for(let x=-3;x<10;x++){const q={...g.current,x};if(g.blocked(q))continue;while(!g.blocked(q,0,1))q.y++;
    let board=structuredClone(p.board);for(const c of cells(q)){if(c.y>=0)board[c.y][c.x]='#abc';}
    const lines=board.filter(r=>r.every(Boolean)).length;board=board.filter(r=>!r.every(Boolean));while(board.length<22)board.unshift(Array(10).fill(null));
    const heights=[];let holes=0;for(let col=0;col<10;col++){let first=22;for(let y=0;y<22;y++){if(board[y][col])first=Math.min(first,y);else if(first<22)holes++;}heights.push(22-first);}
    const height=heights.reduce((a,b)=>a+b,0),bump=heights.slice(1).reduce((a,h,i)=>a+Math.abs(h-heights[i]),0),score=lines*8-height*.5-holes*8-bump*.35;
    if(!best||score>best.score)best={turns,x,score};
  }
}return best;}
let port;
(async()=>{try{
  const file=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(file),15000);const lines=fs.readFileSync(file,'utf8').trim().split('\n');port=lines[0];browser=new CDP(`ws://127.0.0.1:${port}${lines[1]}`);
  const a=await page(),b=await page(),c=await page();
  await check('lobby/create/join/full-room errors with independent storage',async()=>{
    await a.fill('#nickname','테스터 A');await a.fill('#room-title','파란 대결방');await a.click('#create-room');await until(()=>a.eval(`!document.querySelector('#room').hidden`));const code=await a.eval(`document.querySelector('#room-code').textContent`);await until(()=>b.eval(`document.querySelectorAll('.room-row').length===1`));
    await b.fill('#nickname','테스터 B');await b.fill('#join-code',code);await b.click('#join-room');await until(()=>a.eval(`document.querySelector('#opponent-name').textContent==='테스터 B'`));
    await c.fill('#join-code',code);await c.click('#join-room');await until(()=>c.eval(`document.querySelector('#notice').textContent.includes('두 명')`));assert.equal(await c.eval(`document.querySelector('#room').hidden`),true);
    await c.fill('#join-code','000000');await c.click('#join-room');await until(()=>c.eval(`document.querySelector('#notice').textContent.includes('존재하지')`));
    await c.click('#create-room');await until(()=>c.eval(`!document.querySelector('#room').hidden`));await a.shot('duel-01-waiting.png');
  });
  await check('two-player ready, real countdown, identical pieces, countdown input rejection',async()=>{
    await a.click('#ready-button');await delay(150);assert.equal(await a.eval(`document.querySelector('#match-title').textContent`),'준비되면 시작하세요');const at=Date.now();await b.click('#ready-button');await until(()=>a.state?.phase==='countdown');await a.key('Space',' ');assert.equal(a.self().pieces,0);await until(()=>a.state?.phase==='playing'&&b.state?.phase==='playing',6000);assert.ok(Date.now()-at>=2900);assert.equal(a.self().current.type,b.self().current.type);assert.deepEqual(a.self().queue,b.self().queue);
  });
  await check('actual movement/hold/drop replicate to opponent',async()=>{
    const x=a.self().current.x;await a.key('ArrowLeft');await until(()=>a.self().current.x===x-1);await until(()=>b.state.players.find(p=>p.id===a.id).current.x===x-1);
    await a.key('KeyC','c');await until(()=>a.self().canHold===false);const hold=a.self().hold,type=a.self().current.type;await a.key('KeyC','c');await delay(80);assert.equal(a.self().hold,hold);assert.equal(a.self().current.type,type);
    await a.key('Space',' ');await until(()=>a.self().pieces===1);await until(()=>b.state.players.find(p=>p.id===a.id).pieces===1);assert.deepEqual(a.self().board,b.state.players.find(p=>p.id===a.id).board);
  });
  await check('chat is scoped, HTML-safe and releases held movement; R/Space do not play',async()=>{
    await a.send('Input.dispatchKeyEvent',{type:'keyDown',code:'ArrowRight',key:'ArrowRight'});await a.click('#chat-input');await delay(200);const x=a.self().current.x,pieces=a.self().pieces;
    await a.key('KeyR','r');await a.key('Space',' ');await delay(200);assert.equal(a.self().current.x,x);assert.equal(a.self().pieces,pieces);await a.send('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowRight',key:'ArrowRight'});
    const msg='<img src=x onerror=alert(1)> 안녕!';await a.fill('#chat-input',msg);await a.key('Enter','Enter');await until(()=>b.eval(`document.querySelector('#chat-messages').textContent.includes('안녕!')`));assert.equal(await b.eval(`document.querySelector('#chat-messages img')===null`),true);assert.equal(await c.eval(`document.querySelector('#chat-messages').textContent.includes('안녕!')`),false);await a.key('Escape','Escape');
    await b.fill('#chat-input','준비됐어!');await b.click('#chat-send');await until(()=>a.eval(`document.querySelector('#chat-messages').textContent.includes('준비됐어!')`));await b.eval('document.activeElement.blur()');
  });
  await check('solo-size board, left HOLD, vertical NEXT and compact opponent; previews match solo pixels',async()=>{
    const geometry=await a.eval(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};return{board:rect('#self-board'),hold:rect('#duel-hold'),next:[...document.querySelectorAll('#duel-next canvas')].map(c=>({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y})),rival:rect('#opponent-board')};})()`);
    assert.equal(geometry.board.width,300);assert.equal(geometry.board.height,600);assert.ok(geometry.hold.right<geometry.board.x);assert.equal(geometry.next.length,5);
    geometry.next.forEach((r,i)=>{assert.ok(r.x>geometry.board.right);if(i)assert.ok(r.y>geometry.next[i-1].y);});assert.ok(geometry.rival.width<geometry.board.width/2);assert.ok(geometry.rival.x>geometry.next[0].x);
    const p=a.self(),solo=await page('/');
    await solo.eval(`prefs.skin=${JSON.stringify(p.skin)};game.queue=${JSON.stringify(p.queue)};game.hold=${JSON.stringify(p.hold)};drawPreviews();`);
    const soloPixels=await solo.eval(`[document.querySelector('#hold'),...document.querySelectorAll('#next-list canvas')].map(c=>c.toDataURL())`);
    const duelPixels=await a.eval(`[document.querySelector('#duel-hold'),...document.querySelectorAll('#duel-next canvas')].map(c=>c.toDataURL())`);
    assert.deepEqual(duelPixels,soloPixels);assert.deepEqual(await a.eval(`[...document.querySelectorAll('#duel-next canvas')].map(c=>c.dataset.piece)`),p.queue.slice(0,5));
    await browser.send('Target.disposeBrowserContext',{browserContextId:solo.context});
  });
  await check('legal placements create real attacks; delayed garbage reaches opponent',async()=>{
    for(let i=0;i<100&&a.self().sent===0;i++){
      const before=a.self().pieces,p=plan(a.self());assert.ok(p);for(let r=0;r<p.turns;r++)await a.key('KeyX','x');await delay(60);const from=a.self().current.x;for(let dx=0;dx<Math.abs(p.x-from);dx++)await a.key(p.x<from?'ArrowLeft':'ArrowRight');await a.key('Space',' ');await until(()=>a.self().pieces>before);assert.equal(a.state.phase,'playing');
    }
    assert.ok(a.self().sent>0,'must send garbage by clearing lines');await until(()=>b.self().pending>0);await delay(1300);const received=b.self().received,pieces=b.self().pieces;await b.key('Space',' ');await until(()=>b.self().pieces>pieces);assert.ok(b.self().received>received);assert.ok(b.self().received-received<=8);assert.ok(b.self().board.at(-1).filter(Boolean).length===9);await a.shot('duel-02-playing.png');
  });
  await check('forfeit finalizes winner and both-ready rematch resets everything',async()=>{
    await b.click('#forfeit-button');await b.click('#confirm-exit');await until(()=>a.state?.phase==='finished');assert.equal(a.state.result.winner,a.id);await until(()=>a.eval(`document.querySelector('#match-title').textContent.includes('승리')`));await a.shot('duel-03-result.png');const match=a.state.match;
    await a.click('#ready-button');await delay(100);assert.equal(a.state.phase,'finished');await b.click('#ready-button');await until(()=>a.state?.phase==='countdown'&&a.state.match!==match);assert.equal(a.self().pieces,0);assert.equal(a.self().pending,0);await until(()=>a.state?.phase==='playing',6000);
  });
  await check('real disconnect grants win; room accepts replacement and leaves cleanly',async()=>{
    await browser.send('Target.disposeBrowserContext',{browserContextId:b.context});await until(()=>a.state?.phase==='finished');assert.ok(['leave','disconnect'].includes(a.state.result.reason));assert.equal(a.state.result.winner,a.id);await until(()=>a.eval(`document.querySelector('#opponent-name').textContent==='참가 대기 중'`));
    await c.click('#leave-room');await until(()=>c.eval(`!document.querySelector('#lobby').hidden`));const code=await a.eval(`document.querySelector('#room-code').textContent`);await c.fill('#join-code',code);await c.click('#join-room');await until(()=>a.eval(`document.querySelector('#opponent-name').textContent!=='참가 대기 중'`));
  });
  await check('duel lobby/room fits 320-1440px and touch controls work',async()=>{
    for(const width of [320,390,620,621,768,800,801,1000,1024,1100,1101,1440]){await a.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await fits(a,`room at ${width}`);}
    await a.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await a.shot('duel-04-mobile.png');
    await a.click('#ready-button');await c.click('#ready-button');await until(()=>a.state?.phase==='playing',6000);const before=a.self().pieces;await a.click('[data-action="drop"]');await until(()=>a.self().pieces>before);
    await a.click('#leave-room');await a.click('#confirm-exit');await until(()=>a.eval(`!document.querySelector('#lobby').hidden`));for(const width of [320,390,768,1440]){await a.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await fits(a,`lobby at ${width}`);}await a.shot('duel-05-lobby.png');
  });
  await check('no browser errors or missing assets',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(out,'battle-browser-results.json'),JSON.stringify({passed,errors,base,testedAt:new Date().toISOString()},null,2));console.log(`Online browser checks passed: ${passed}`);
}catch(e){console.error(e.stack);for(let i=1;i<connections.length;i++)try{await connections[i].shot(`duel-failure-${i}.png`);}catch{}process.exitCode=1;}
finally{if(browser)try{await browser.send('Browser.close');}catch{}for(const c of connections){for(const p of c.pending.values())clearTimeout(p.timer);c.ws.close();}proc.kill();}})();
