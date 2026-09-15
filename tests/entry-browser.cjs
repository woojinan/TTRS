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
  async drag(selector,dx,dy){await this.send('Page.bringToFront');const r=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...r});assert.match(await this.eval('getComputedStyle(document.body).cursor'),/resize$/);for(let i=1;i<=5;i++)await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:r.x+dx*i/5,y:r.y+dy*i/5});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:r.x+dx,y:r.y+dy});}
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


(async()=>{let entry,member;try{
  const file=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(file),15000);const lines=fs.readFileSync(file,'utf8').trim().split('\n');port=lines[0];browser=new CDP('ws://127.0.0.1:'+port+lines[1]);
  await check('welcome login/signup layout and invite-preserving guest entry',async()=>{
    entry=await page('/?next=%2Fbattle%3Froom%3DABCDEF');await entry.shot('welcome-desktop.png');
    for(const width of [320,390,768,1440]){await entry.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await fits(entry,'welcome '+width);}
    await entry.click('#tab-register');assert.equal(await entry.eval("document.querySelector('#entry-register').hidden"),false);await entry.click('#tab-login');
    await entry.click('#guest-enter');await until(()=>entry.eval("document.body?.dataset.connected==='true'"));assert.equal(await entry.eval("document.querySelector('#join-code').value"),'ABCDEF');
    assert.match(await entry.eval("document.querySelector('#nickname').value"),/^guest_\d{5,6}$/);
    await entry.click('#create-room');await until(()=>entry.state?.total===1);const name=await entry.eval("document.querySelector('#nickname').value");assert.equal(await entry.eval("document.querySelector('#active-room-title').textContent"),name+'s_room');
    assert.equal(await entry.eval("document.querySelector('#ready-button').hidden"),true);assert.equal(await entry.eval("document.querySelector('#start-match').disabled"),true);
  });
  await check('incoming-height rail aligns with cells, distinguishes maturity and scales on drag',async()=>{
    await entry.eval("TTRSGarbage.render(7,3)");
    let values=await entry.eval("({red:document.querySelectorAll('#garbage-rail [data-state=ready]').length,yellow:document.querySelectorAll('#garbage-rail [data-state=warning]').length,height:document.querySelector('#garbage-forecast').getBoundingClientRect().height,board:document.querySelector('#self-board').getBoundingClientRect().height})");
    assert.equal(values.red,3);assert.equal(values.yellow,4);assert.ok(Math.abs(values.height-values.board*.35)<1);
    await entry.drag('[data-resize=board-right]',60,0);
    values=await entry.eval("({height:document.querySelector('#garbage-forecast').getBoundingClientRect().height,board:document.querySelector('#self-board').getBoundingClientRect().height})");assert.equal(values.board,720);assert.ok(Math.abs(values.height-252)<1);await entry.shot('incoming-height-preview.png');
    await entry.eval("TTRSGarbage.render(27,12)");assert.equal(await entry.eval("document.querySelector('#garbage-forecast').style.height"),'100%');assert.match(await entry.eval("document.querySelector('#garbage-forecast').textContent"),/27줄.*초과/);assert.match(await entry.eval("document.querySelector('#garbage-rail').getAttribute('aria-valuetext')"),/최대 8줄/);
    await entry.eval("TTRSGarbage.render(0,0)");assert.equal(await entry.eval("document.querySelector('#garbage-forecast').hidden"),true);
  });
  await check('welcome registration and login enter game; existing member can continue',async()=>{
    member=await page('/?next=%2Fplay');const suffix=String(Date.now()).slice(-9);
    await member.click('#tab-register');await member.fill('#new-username','entry'+suffix);await member.fill('#new-nickname','player'+suffix);await member.fill('#new-password','preview-password-123');await member.click('#entry-register button');
    await until(()=>member.eval("typeof TTRSAccount!=='undefined'&&Boolean(TTRSAccount.user?.username)"));
    await member.send('Page.navigate',{url:base+'/'});await until(()=>member.eval("Boolean(document.querySelector('#returning-user'))&&!document.querySelector('#returning-user').hidden"));await member.click('#switch-account');await until(()=>member.eval("!document.querySelector('#entry-auth').hidden&&!document.querySelector('#guest-enter').disabled"));
    await member.fill('#entry-username','entry'+suffix);await member.fill('#entry-password','preview-password-123');await member.click('#entry-login button');await until(()=>member.eval("location.pathname==='/play'&&typeof phase!=='undefined'"));
    assert.equal(await member.eval("TTRSAccount.ready.then(u=>u.username)"),'entry'+suffix);
  });
  await check('solo edge/corner resizing preserves aspect ratio and clamps bounds',async()=>{
    assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),300);
    await member.drag('[data-resize=board-corner]',25,50);assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),325);
    await member.drag('[data-resize=board-bottom]',0,100);assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),375);
    await member.drag('[data-resize=board-left]',80,0);assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),295);
    await member.drag('[data-resize=board-right]',200,0);assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),420);
    await member.drag('[data-resize=board-right]',-220,0);assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),220);
    assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().height"),440);assert.equal(await member.eval("document.body.classList.contains('resizing')"),false);
    await member.send('Page.reload',{ignoreCache:true});await until(()=>member.eval("typeof phase!=='undefined'&&document.readyState==='complete'"));assert.equal(await member.eval("document.querySelector('#board').getBoundingClientRect().width"),220);
  });
  await check('untrusted redirect cannot leave this service',async()=>{
    const safe=await page('/?next=https%3A%2F%2Fevil.invalid');await safe.click('#guest-enter');await until(()=>safe.eval("location.pathname==='/play'&&typeof phase!=='undefined'"));assert.equal(await safe.eval("location.origin"),base);
  });
  assert.deepEqual(errors,[]);console.log('Entry and drag checks passed: '+passed);
}catch(e){console.error(e);console.error(errors);if(entry)await entry.shot('entry-failure.png').catch(()=>{});if(member)await member.shot('resize-failure.png').catch(()=>{});process.exitCode=1;}
finally{for(const c of connections)c.ws.close();proc.kill();}
})();
