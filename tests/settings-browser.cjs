/* Real Chromium pages, shared-origin storage events, canvas pixels and A-key tucks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{setTimeout:delay}=require('node:timers/promises');
const base=process.env.TTRS_URL||'http://127.0.0.1:1559',out=path.resolve('.test-artifacts');
fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'settings-browser-'));
const proc=spawn(process.env.TTRS_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'],{windowsHide:true,stdio:'ignore'});
const errors=[],sessions=[];let browser,port,passed=0;
async function until(fn,timeout=8000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await fn())return;await delay(40);}throw Error('Condition timeout');}
class CDP {
  constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.frames=[];this.ready=new Promise((yes,no)=>{this.ws.onopen=yes;this.ws.onerror=no;});sessions.push(this);
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.no(Error(m.error.message)):p.yes(m.result);}}else{
      if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
      if(m.method==='Network.responseReceived'&&m.params.response.status>=400)errors.push(m.params.response.url);
      if(m.method==='Network.webSocketFrameSent')try{this.frames.push(JSON.parse(m.params.response.payloadData));}catch{}
    }};
  }
  async send(method,params={}){await this.ready;return new Promise((yes,no)=>{const id=++this.seq,timer=setTimeout(()=>no(Error(method+' timeout')),10000);this.pending.set(id,{yes,no,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async click(selector){await this.send('Page.bringToFront');const r=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await this.send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...r});}
  async key(code,key=code){for(const type of ['keyDown','keyUp'])await this.send('Input.dispatchKeyEvent',{type,code,key});}
  async set(name,value){await this.eval(`(()=>{const e=document.querySelector('#pref-${name}');${typeof value==='boolean'?'e.checked':'e.value'}=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
  async shot(name){await this.send('Page.bringToFront');await this.eval(`scrollTo(0,0);new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);const m=await this.send('Page.getLayoutMetrics'),{width,height}=m.cssContentSize;const r=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));}
}
async function page(route,context){const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context});const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(),p=new CDP(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
  await p.send('Runtime.enable');await p.send('Page.enable');await p.send('Network.enable');await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:base+route});await until(()=>p.eval(`document.readyState==='complete'&&typeof TTRSPreferences!=='undefined'`));return p;
}
async function check(name,fn){await fn();console.log(`PASS ${++passed}: ${name}`);}
(async()=>{let solo,settings,battle;try{
  const file=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(file),15000);const lines=fs.readFileSync(file,'utf8').trim().split('\n');port=lines[0];browser=new CDP(`ws://127.0.0.1:${port}${lines[1]}`);
  const {browserContextId}=await browser.send('Target.createBrowserContext');solo=await page('/',browserContextId);settings=await page('/settings',browserContextId);battle=await page('/battle',browserContextId);
  await check('default ghost is visibly filled across all five skins',async()=>{
    assert.equal(await solo.eval('prefs.ghostOpacity'),55);
    const alphas=await solo.eval(`BlockSkins.catalog.map(s=>{const c=document.createElement('canvas');c.width=c.height=30;const g=c.getContext('2d');BlockSkins.draw(g,0,0,30,'T',s.id,true);return g.getImageData(15,15,1,1).data[3];})`);
    alphas.forEach(alpha=>assert.ok(alpha>=139&&alpha<=141));assert.equal(await solo.eval(`document.querySelector('.preferences-link').target`),'_blank');
  });
  await check('settings entry is a compact rounded button, fits mobile and opens a separate tab',async()=>{
    for(const p of [solo,battle])for(const width of [320,390,768,1440]){
      // Phones use overlay scrollbars; keep desktop scrollbars for wider checks.
      await p.send('Emulation.setScrollbarsHidden',{hidden:width<=390});
      await p.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      const box=await p.eval(`(()=>{const e=document.querySelector('.preferences-link'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:e.textContent.trim(),height:r.height,right:r.right,width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,radius:parseFloat(s.borderRadius),title:e.title};})()`);
      assert.equal(box.text,'플레이 설정');assert.ok(box.height>=42&&box.radius>=12);assert.ok(box.right<=box.width&&box.scroll<=box.width,JSON.stringify({viewport:width,page:p===solo?'solo':'battle',...box}));assert.match(box.title,/계속 진행/);
    }
    await solo.shot('preferences-button-solo.png');await battle.shot('preferences-button-battle.png');
    await battle.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await battle.shot('preferences-button-mobile.png');
    const before=new Set((await browser.send('Target.getTargets')).targetInfos.map(t=>t.targetId));await battle.click('.preferences-link');let opened;
    await until(async()=>{opened=(await browser.send('Target.getTargets')).targetInfos.find(t=>!before.has(t.targetId)&&t.url===base+'/settings');return Boolean(opened);});await browser.send('Target.closeTarget',{targetId:opened.targetId});
    await battle.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  });
  await check('preview responds without saving and dependent sliders disable',async()=>{
    const before=await settings.eval(`document.querySelector('#settings-board').toDataURL()`);await settings.set('ghostOpacity',80);assert.notEqual(await settings.eval(`document.querySelector('#settings-board').toDataURL()`),before);assert.equal(await solo.eval('prefs.ghostOpacity'),55);
    await settings.set('ghost',false);assert.equal(await settings.eval(`document.querySelector('#pref-ghostOpacity').disabled`),true);await settings.set('ghost',true);await settings.set('grid',false);assert.equal(await settings.eval(`document.querySelector('#pref-gridOpacity').disabled`),true);
    await settings.set('das',0);await settings.set('arr',0);await settings.set('boardTheme','ocean');await settings.set('skin','neon');await settings.set('muted',true);await settings.set('effects',false);
  });
  await check('saving syncs solo and an existing online room via real storage events',async()=>{
    await until(()=>battle.eval(`document.body.dataset.connected==='true'`));await battle.click('#create-room');await until(()=>battle.eval(`!document.querySelector('#room').hidden`));const code=await battle.eval(`document.querySelector('#room-code').textContent`);
    await settings.click('#save-preferences');await until(()=>solo.eval(`prefs.ghostOpacity===80&&prefs.das===0&&prefs.skin==='neon'`));await until(()=>battle.eval(`document.querySelector('#battle-das').value==='0'&&document.querySelector('#battle-skin').value==='neon'`));
    assert.ok(battle.frames.some(m=>m.type==='settings'&&m.arr===0&&m.skin==='neon'));assert.equal(await battle.eval(`document.querySelector('#room-code').textContent`),code);
    assert.deepEqual(await solo.eval(`Array.from(ctx.getImageData(0,0,1,1).data)`),[12,37,57,255]);assert.deepEqual(await battle.eval(`Array.from(document.querySelector('#self-board').getContext('2d').getImageData(0,0,1,1).data)`),[12,37,57,255]);
    await settings.send('Page.reload',{ignoreCache:true});await until(()=>settings.eval(`document.querySelector('#pref-ghostOpacity')?.value==='80'`));assert.equal(await settings.eval(`document.querySelector('#pref-boardTheme').value`),'ocean');
  });
  await check('restoring defaults requires save and preserves unrelated records',async()=>{
    await solo.eval(`localStorage.setItem('ttrs-online-name',JSON.stringify('기록 유지'));`);await settings.click('#reset-preferences');assert.equal(await solo.eval('prefs.ghostOpacity'),80);await settings.click('#save-preferences');await until(()=>solo.eval('prefs.ghostOpacity===55&&prefs.das===133'));assert.equal(await solo.eval(`JSON.parse(localStorage.getItem('ttrs-online-name'))`),'기록 유지');assert.equal(await settings.eval(`document.querySelector('#pref-grid').checked`),true);await settings.shot('settings-desktop.png');
  });
  await check('settings fits desktop, tablet and mobile without clipped controls',async()=>{
    for(const width of [320,390,620,720,721,768,1024,1440]){await settings.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});const dimensions=await settings.eval(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})`);assert.ok(dimensions.scroll<=dimensions.width,JSON.stringify({width,...dimensions}));}
    await settings.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await settings.shot('settings-mobile.png');
  });
  await check('actual A-key performs mirrored L/J tucks in the solo browser',async()=>{
    for(const f of require('./spin-fixtures.cjs')){
      await solo.eval(`(()=>{const f=${JSON.stringify(f)};game=new Game();game.current=clone(f.type);game.rotate(f.rotation,0);game.current.x=f.x;f.rows.forEach((r,i)=>game.board[16+i]=[...r].map(v=>v==='#'?'#647580':null));while(game.down(performance.now())){}phase='playing';startedAt=performance.now();game.groundedAt=performance.now();resetInput();updateHud();drawPreviews();draw(performance.now());})()`);
      await solo.key('KeyA','a');const actual=await solo.eval(`({x:game.current.x,y:game.current.y,r:game.current.r,kick:game.lastKick})`);assert.deepEqual(actual,{x:f.afterX,y:f.y,r:f.afterR,kick:1});
      if(f.type==='L')await solo.shot('spin-L-180.png');await solo.eval(`phase='ready';resetInput();`);
    }
  });
  await check('saved handling controls real horizontal key repeat',async()=>{
    await settings.set('das',0);await settings.set('arr',0);await settings.click('#save-preferences');await until(()=>solo.eval('prefs.arr===0&&prefs.das===0'));
    await solo.send('Page.bringToFront');await solo.eval(`game=new Game();game.current=clone('O');phase='playing';startedAt=performance.now();resetInput();armFrame();`);await solo.send('Input.dispatchKeyEvent',{type:'keyDown',code:'ArrowLeft',key:'ArrowLeft'});await until(()=>solo.eval('game.current.x===0'));await solo.send('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowLeft',key:'ArrowLeft'});await solo.eval(`phase='ready';resetInput();`);
    await settings.click('#reset-preferences');await settings.click('#save-preferences');
  });
  await check('storage failure is explicit and never reports a successful save',async()=>{
    await settings.eval(`Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');}`);await settings.set('das',77);await settings.click('#save-preferences');assert.match(await settings.eval(`document.querySelector('#save-status').textContent`),/저장하지 못했습니다/);assert.equal(await solo.eval('prefs.das'),133);
    await settings.eval(`window.onbeforeunload=null;`); // Context disposal below does not navigate.
  });
  await check('no browser exceptions or missing assets',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(out,'settings-browser-results.json'),JSON.stringify({passed,errors,base},null,2));console.log(`Settings browser checks passed: ${passed}`);
}catch(e){console.error(e.stack);for(const [i,p] of [solo,settings,battle].entries())if(p)try{await p.shot(`settings-failure-${i}.png`);}catch{}process.exitCode=1;}
finally{if(browser)try{await browser.send('Browser.close');}catch{}for(const p of sessions){for(const v of p.pending.values())clearTimeout(v.timer);p.ws.close();}proc.kill();}})();
