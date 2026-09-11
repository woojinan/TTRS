/* Real Chrome + CDP, using Node's built-in WebSocket (Node 22+). */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const artifacts=path.resolve('.test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const profile=fs.mkdtempSync(path.join(artifacts,'chrome-'));
const chrome=process.env.TTRS_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url=process.env.TTRS_URL||'http://127.0.0.1:8000';
const quick=process.argv.includes('--quick');
const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1440,1100','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,seq=0,passed=0;const pending=new Map(),errors=[],networkErrors=[];
proc.on('error',e=>console.error(e));
function send(method,params={}) {return new Promise((resolve,reject)=>{const id=++seq;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},15000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression) {const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression,timeout=6000) {const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(40);}throw new Error(`Timed out: ${expression}`);}
async function check(name,work) {await work();passed++;console.log(`PASS ${passed}: ${name}`);}
async function click(selector) {const box=await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest',inline:'nearest'});const r=element.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function key(key,code=key) {await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});}
async function screenshot(name,full=false) {if(full){const m=await send('Page.getLayoutMetrics');const {width,height}=m.cssContentSize;const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});fs.writeFileSync(path.join(artifacts,name),Buffer.from(shot.data,'base64'));}else{const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,name),Buffer.from(shot.data,'base64'));}}
async function well(){await evaluate(`(()=>{game.board=Array.from({length:22},()=>Array(10).fill(null));for(let y=18;y<22;y++)game.board[y]=Array.from({length:10},(_,x)=>x===5?null:'#647580');game.current=clone('I');game.rotate(1,performance.now());game.current.x=3;game.current.y=10;game.resetPiece(performance.now());draw(performance.now());})()`);}
async function reload(){const previous=await evaluate('performance.timeOrigin');await send('Page.reload',{ignoreCache:true});await until(`performance.timeOrigin!==${previous}&&typeof phase!=='undefined'&&phase==='ready'&&document.readyState==='complete'`);}
async function startFast(){await evaluate(`start();countdownAt=performance.now()-3001;`);await until(`phase==='playing'`);}
(async()=>{
  try {
    const activeFile=path.join(profile,'DevToolsActivePort');const deadline=Date.now()+15000;
    while(!fs.existsSync(activeFile)){if(Date.now()>deadline)throw new Error('Chrome did not publish DevToolsActivePort');await delay(100);}
    const port=fs.readFileSync(activeFile,'utf8').split('\n')[0];
    const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timeout);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)networkErrors.push(m.params.response.url);};
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url});await until(`document.readyState==='complete'&&typeof phase!=='undefined'`);
    await check('initial page, scripts, mode controls and board layout',async()=>{
      assert.equal(await evaluate('phase'),'ready');assert.equal(await evaluate(`document.querySelectorAll('#next-list canvas').length`),5);
      assert.equal(await evaluate(`document.querySelector('#result').hidden`),true);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
      assert.equal(await evaluate(`(()=>{const b=canvas.getBoundingClientRect(),w=document.querySelector('.board-wrap').getBoundingClientRect();return b.width===300&&b.height===600&&w.width>=b.width&&w.height>=b.height;})()`),true);
      await screenshot('01-ready.png');
    });
    await check('five distinct skins apply to placed/current blocks, hold and next without changing the game',async()=>{
      await startFast();
      await evaluate(`game.board=Array.from({length:22},()=>Array(10).fill(null));Object.values(Tetris.PIECES).forEach((p,i)=>{game.board[21][i+1]=p.c;if(i<5)game.board[20][i+2]=p.c;if(i<3)game.board[19][i+3]=p.c;});game.current=clone('T');game.current.y=6;game.hold='L';game.gravityAt=performance.now()+100000;effects=[];feedbackUntil=0;drawPreviews();draw(performance.now());`);
      const before=await evaluate(`JSON.stringify({board:game.board,current:game.current,score:game.score,lines:game.lines,hold:game.hold,queue:game.queue})`);
      const renders=[];
      for(const skin of ['jelly','mochi','crystal','neon','retro']){
        await click('#skins-button');assert.equal(await evaluate(`document.querySelectorAll('[data-skin]').length`),5);
        await click(`[data-skin="${skin}"]`);assert.equal(await evaluate('prefs.skin'),skin);
        assert.equal(await evaluate(`document.querySelectorAll('[data-skin][aria-pressed="true"]').length`),1);
        assert.equal(await evaluate(`JSON.parse(localStorage.getItem(SETTINGS)).skin`),skin);
        assert.equal(await evaluate(`JSON.stringify({board:game.board,current:game.current,score:game.score,lines:game.lines,hold:game.hold,queue:game.queue})`),before);
        renders.push(await evaluate(`({board:canvas.toDataURL(),hold:document.querySelector('#hold').toDataURL(),next:document.querySelector('#next-list canvas').toDataURL()})`));
        if(skin==='mochi')await screenshot('07-skin-picker.png');
        await click('#done-skins');await until('!skinsDialog.open');await evaluate('window.scrollTo(0,0)');await screenshot(`skin-${skin}.png`);
      }
      for(const target of ['board','hold','next'])assert.equal(new Set(renders.map(r=>r[target])).size,5,`${target} must render five distinct skins`);
      await reload();assert.equal(await evaluate('prefs.skin'),'retro');assert.equal(await evaluate(`document.querySelector('#current-skin-name').textContent`),'레트로');
      await click('#skins-button');await click('[data-skin="jelly"]');await click('#done-skins');await until('!skinsDialog.open');
    });
    await check('skin dialog blocks game shortcuts and supports Escape',async()=>{
      await startFast();await click('#skins-button');assert.equal(await evaluate('skinsDialog.open'),true);const before=await evaluate('game.pieces');await key('r','KeyR');assert.equal(await evaluate('game.pieces'),before);assert.equal(await evaluate('phase'),'playing');await key(' ','Space');assert.equal(await evaluate('game.pieces'),before);
      await key('Escape');await until('!skinsDialog.open');await reload();
    });
    await check('real 3-second countdown blocks input and excludes preparation time',async()=>{
      const wall=Date.now();await click('#start-button');assert.equal(await evaluate('phase'),'countdown');
      await key(' ','Space');assert.equal(await evaluate('game.pieces'),0);assert.equal(await evaluate('elapsed'),0);
      await until(`phase==='playing'`,5000);assert.ok(Date.now()-wall>=2900);assert.ok(await evaluate('elapsed<250'));
      await key('ArrowLeft');await key('x','KeyX');await key('c','KeyC');assert.equal(await evaluate('game.canHold'),false);
      await key(' ','Space');assert.equal(await evaluate('game.pieces'),1);
    });
    await check('audio produces a signal and mute zeros both channels',async()=>{
      await evaluate(`window.qaAnalyser=sound.context.createAnalyser();sound.sfx.connect(qaAnalyser);`);
      const peak=await evaluate(`new Promise(resolve=>{play('special',3);setTimeout(()=>{const a=new Float32Array(qaAnalyser.fftSize);qaAnalyser.getFloatTimeDomainData(a);resolve(Math.max(...a.map(Math.abs)));},50);})`);
      assert.ok(peak>0,'effect signal must be audible in the graph');
      await click('#settings-button');await click('#mute-input');await until('sound.sfx.gain.value===0&&sound.music.gain.value===0');
      await click('#mute-input');await evaluate(`document.querySelector('#sfx-input').value=42;document.querySelector('#sfx-input').dispatchEvent(new Event('input'));document.querySelector('#music-input').value=17;document.querySelector('#music-input').dispatchEvent(new Event('input'));`);
      const before=await evaluate('game.pieces');await key(' ','Space');assert.equal(await evaluate('game.pieces'),before);
      await screenshot('02-settings.png');await click('#save-settings');await until('!dialog.open&&JSON.parse(localStorage.getItem(SETTINGS)||"{}").sfx===42');assert.equal(await evaluate(`JSON.parse(localStorage.getItem(SETTINGS)).sfx`),42);
    });
    await check('drop/clear effects do not delay the next input',async()=>{
      await well();await key(' ','Space');assert.ok(await evaluate(`effects.some(e=>e.kind==='drop')&&effects.some(e=>e.kind==='clear')`));
      const x=await evaluate('game.current.x');await key('ArrowLeft');assert.equal(await evaluate('game.current.x'),x-1);
      assert.equal(await evaluate('game.lines'),4);assert.ok(await evaluate('game.score>=2800'));
    });
    await check('last ten lines highlight and sprint completes through real drops',async()=>{
      while(await evaluate('game.lines<32')){await well();await key(' ','Space');}
      assert.equal(await evaluate(`document.querySelector('.board-column').classList.contains('final-stretch')`),true);
      await screenshot('03-final-stretch.png');
      while(await evaluate(`phase==='playing'`)){await well();await key(' ','Space');}
      assert.equal(await evaluate('game.lines'),40);assert.equal(await evaluate(`document.querySelector('#overlay-title').textContent`),'COMPLETE');
      assert.equal(await evaluate(`document.querySelector('#board-feedback').classList.contains('visible')`),false);
      assert.equal(await evaluate('records.length'),1);assert.equal(await evaluate('records[0].completed'),true);
      assert.equal(await evaluate(`document.querySelectorAll('#result-stats dd').length`),9);
      assert.ok(await evaluate('records[0].pps>0&&bests.sprint===records[0].elapsed'));
      const score=await evaluate('game.score');await key(' ','Space');assert.equal(await evaluate('game.score'),score);assert.equal(await evaluate('dialog.open'),false);
      await screenshot('04-sprint-result.png',true);
    });
    await check('records and audio settings survive reload',async()=>{await reload();assert.equal(await evaluate('records.length'),1);assert.equal(await evaluate('prefs.sfx'),42);assert.equal(await evaluate('prefs.music'),17);assert.ok(await evaluate('bests.sprint>0'));});
    await check('incomplete sprint is recorded without replacing best',async()=>{
      const best=await evaluate('bests.sprint');await startFast();await evaluate(`game.current=clone('O');game.current.x=0;game.current.y=0;game.board[2][0]='#abc';game.board[2][1]='#abc';`);await key(' ','Space');
      assert.equal(await evaluate('phase'),'finished');assert.equal(await evaluate('records[0].completed'),false);assert.equal(await evaluate('bests.sprint'),best);
    });
    await check('restart clears held keys, effects, counters and runs one frame loop',async()=>{
      await startFast();await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await key('r','KeyR');
      assert.equal(await evaluate('phase'),'countdown');assert.equal(await evaluate('direction'),0);assert.equal(await evaluate('game.pieces'),0);assert.equal(await evaluate('effects.length'),0);
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await evaluate(`countdownAt=performance.now()-3001;`);await until(`phase==='playing'`);
      await evaluate(`finish(false);`);
    });
    await check('held movement honors DAS, instant ARR and last pressed direction',async()=>{
      await startFast();await evaluate(`prefs.das=150;prefs.arr=0;game.current=clone('O');`);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
      assert.equal(await evaluate('game.current.x'),3);await delay(70);assert.equal(await evaluate('game.current.x'),3);
      await until('game.current.x===0');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await until('game.current.x===8');
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await until('game.current.x===0');
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});
      await evaluate(`keys.ArrowLeft=true;direction=-1;window.dispatchEvent(new Event('blur'));`);assert.equal(await evaluate('direction'),0);
      assert.equal(await evaluate('Object.keys(keys).length'),0);await evaluate('finish(false)');
    });
    await check('two-minute mode has its own timer, history and best score',async()=>{
      await click('[data-mode="attack"]');assert.equal(await evaluate('mode'),'attack');assert.equal(await evaluate(`document.querySelector('#time').textContent`),'02:00.00');
      assert.equal(await evaluate(`document.querySelector('#history-table').hidden`),true);
      await click('#start-button');await until(`phase==='playing'`,5000);
    });
    await check(quick?'accelerated attack deadline completes exactly once':'full real-time 120-second attack completes exactly once',async()=>{
      const wall=Date.now();let drops=0;
      console.log(quick?'Running accelerated deadline regression...':'Running full 120-second timer with repeated legal four-line clears...');
      while(await evaluate(`phase==='playing'`)){
        if(Date.now()-wall>125000)throw new Error('Time attack did not end');
        await well();await key(' ','Space');drops++;
        if(drops%5===0)console.log(`Timer exercise: ${Math.floor((Date.now()-wall)/1000)} seconds, ${drops} clears`);
        if(quick){if(drops===11)await evaluate('startedAt=performance.now()-ATTACK_MS;');await delay(30);}else await delay(4500);
      }
      if(!quick)assert.ok(Date.now()-wall>=119000);assert.equal(await evaluate('elapsed'),120000);
      assert.equal(await evaluate(`document.querySelector('#time').textContent`),'00:00.00');assert.equal(await evaluate(`document.querySelector('#overlay-title').textContent`),'TIME UP');
      assert.ok(await evaluate('game.lines>40'));assert.equal(await evaluate('records.filter(r=>r.mode==="attack").length'),1);
      assert.equal(await evaluate('records[0].elapsed'),120000);assert.equal(await evaluate('bests.attack'),await evaluate('game.score'));
      await screenshot('05-attack-result.png',true);
    });
    await check('deadline rejects input even before the next animation frame',async()=>{
      await startFast();await evaluate(`startedAt=performance.now()-ATTACK_MS;`);await key(' ','Space');
      assert.equal(await evaluate('phase'),'finished');assert.equal(await evaluate('game.pieces'),0);assert.equal(await evaluate('elapsed'),120000);
    });
    await check('history retains ten runs per mode and comparisons show improvement',async()=>{
      const expected=await evaluate(`(()=>{const baseline=bests.attack+100;for(let i=0;i<12;i++){start();begin(performance.now());game.score=baseline+i;finish(true,startedAt+ATTACK_MS);}return baseline+11;})()`);
      assert.equal(await evaluate('records.filter(r=>r.mode==="attack").length'),10);assert.equal(await evaluate(`document.querySelectorAll('#history-body tr').length`),10);
      assert.equal(await evaluate('bests.attack'),expected);assert.ok(await evaluate(`document.querySelector('#result-comparison').textContent.includes('1점 높습니다')`));
      await reload();assert.equal(await evaluate('records.filter(r=>r.mode==="attack").length'),10);assert.ok(await evaluate('records.some(r=>r.mode==="sprint")'));
    });
    await check('light layout and skin picker fit narrow and short viewports',async()=>{
      for(const width of [320,390,620,768,1024]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`overflow at ${width}`);
      }
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await screenshot('06-narrow.png',true);
      await click('#skins-button');await click('[data-skin="neon"]');assert.equal(await evaluate('prefs.skin'),'neon');await screenshot('08-skins-narrow.png');await click('#done-skins');await until('!skinsDialog.open');
      await send('Emulation.setDeviceMetricsOverride',{width:1024,height:650,deviceScaleFactor:1,mobile:false});
      await click('#settings-button');await click('#save-settings');await until('!dialog.open');
      await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    });
    await check('corrupt saved data falls back without a startup crash',async()=>{
      await evaluate(`localStorage.setItem(HISTORY,'bad json');localStorage.setItem(SETTINGS,JSON.stringify({das:-90,arr:999,sfx:'bad',music:150,skin:'missing'}));`);await reload();assert.equal(await evaluate('prefs.skin'),'jelly');
      assert.equal(await evaluate('records.length'),0);assert.equal(await evaluate('prefs.das'),0);assert.equal(await evaluate('prefs.arr'),100);assert.equal(await evaluate('prefs.sfx'),65);assert.equal(await evaluate('prefs.music'),100);
    });
    await check('unavailable storage allows playing and finishing',async()=>{
      await evaluate(`Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')};`);await startFast();await evaluate('finish(false)');
      assert.equal(await evaluate('phase'),'finished');assert.equal(await evaluate('storageOK'),false);assert.ok(await evaluate(`document.querySelector('#storage-note').textContent.includes('이번 접속 중')`));
    });
    await check('zero-point ties are not reported as a new best',async()=>{
      await evaluate(`selectMode('attack');bests.attack=0;records=[];start();begin(performance.now());finish(true,startedAt+ATTACK_MS);start();begin(performance.now());finish(true,startedAt+ATTACK_MS);`);
      assert.equal(await evaluate(`document.querySelector('#result-title').textContent`),'CHALLENGE COMPLETE');
      assert.ok(await evaluate(`document.querySelector('#result-comparison').textContent.includes('동률')`));
    });
    await check('no browser exceptions or missing assets',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(networkErrors,[]);});
    fs.writeFileSync(path.join(artifacts,quick?'browser-quick-results.json':'browser-results.json'),JSON.stringify({passed,quick,errors,networkErrors,testedAt:new Date().toISOString(),url},null,2));
    console.log(`Browser checks passed: ${passed}`);
  } catch(error) {console.error(error.stack);if(socket?.readyState===1){try{await screenshot('failure.png',true);}catch{}}process.exitCode=1;}
  finally {if(socket?.readyState===1){try{await send('Browser.close');}catch{}socket.close();}proc.kill();}
})();
