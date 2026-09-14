"use strict";
const {Game,cells,clone}=Tetris;
const $=selector=>document.querySelector(selector);
const BEST="ttrs-40-lines-best",ATTACK_BEST="ttrs-attack-best",SETTINGS="ttrs-input-settings",HISTORY="ttrs-run-history-v1";
const ATTACK_MS=120000,COUNTDOWN_MS=3000;
let storageOK=true;
function read(key,fallback) { try { const raw=localStorage.getItem(key); return raw===null?fallback:JSON.parse(raw); } catch(_) {storageOK=false;return fallback;} }
function write(key,value) { try {localStorage.setItem(key,JSON.stringify(value));} catch(_) {storageOK=false;storageNotice();} }
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
const savedPrefs=read(SETTINGS,{})||{};
let prefs={das:clamp(savedPrefs.das,0,300,133),arr:clamp(savedPrefs.arr,0,100,10),ghost:savedPrefs.ghost!==false,sfx:clamp(savedPrefs.sfx,0,100,65),music:clamp(savedPrefs.music,0,100,20),muted:savedPrefs.muted===true,effects:savedPrefs.effects!==false};
prefs.skin=BlockSkins.get(savedPrefs.skin).id;
let records=read(HISTORY,[]);
records=Array.isArray(records)?records.filter(r=>r&&["sprint","attack"].includes(r.mode)&&[r.elapsed,r.score,r.lines,r.pps].every(n=>Number.isFinite(n)&&n>=0)&&typeof r.date==="string"&&Number.isFinite(Date.parse(r.date))&&typeof r.completed==="boolean").slice(0,20):[];
const savedSprintBest=Number(read(BEST,0)),savedAttackBest=Number(read(ATTACK_BEST,0));
const bests={sprint:Number.isFinite(savedSprintBest)&&savedSprintBest>0?savedSprintBest:0,attack:Number.isFinite(savedAttackBest)&&savedAttackBest>0?savedAttackBest:0};
const sound=new GameAudio(),canvas=$("#board"),ctx=canvas.getContext("2d"),holdCtx=$("#hold").getContext("2d"),dialog=$("#settings-dialog");
const skinsDialog=$("#skins-dialog"),skinTiles=new Map();
canvas.width=600;canvas.height=1200;ctx.scale(2,2);
$("#hold").width=240;$("#hold").height=240;$("#hold").style.width="120px";$("#hold").style.height="120px";holdCtx.scale(2,2);
const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
let game=new Game(),mode="sprint",phase="ready",startedAt=0,countdownAt=0,countdownNumber=0,elapsed=0;
let keys={},direction=0,repeatAt=0,softAt=0,effects=[],feedbackUntil=0,frame=null;
function fmt(ms) {const n=Math.max(0,Math.floor(ms/10));return `${String(Math.floor(n/6000)).padStart(2,"0")}:${String(Math.floor(n/100)%60).padStart(2,"0")}.${String(n%100).padStart(2,"0")}`;}
function storageNotice() {$("#storage-note").textContent=storageOK?"기록과 설정은 이 브라우저에 저장됩니다.":"브라우저 저장소를 사용할 수 없어 이번 접속 중에만 기록과 설정을 유지합니다.";}
function resetInput() {keys={};direction=0;repeatAt=0;softAt=0;}
function play(name,combo) {sound.configure(prefs);sound.play(name,combo);}
function armFrame() {if(frame===null)frame=requestAnimationFrame(tick);}
function remaining(now=performance.now()) {return Math.max(0,ATTACK_MS-(now-startedAt));}
function canAct(now) {
  if(phase!=="playing")return false;
  if(mode==="attack"&&remaining(now)<=0) {finish(true,startedAt+ATTACK_MS);return false;}
  return true;
}
function flash(text,now,special=false) {
  if(!prefs.effects)return;
  const node=$("#board-feedback");node.textContent=text;node.classList.toggle("special",special);node.classList.add("visible");feedbackUntil=now+750;
}
function afterLock(event,now,drop=false) {
  if(!event)return;
  if(prefs.effects) {
    effects.push({kind:"lock",cells:event.placed,color:event.color,at:now,duration:180});
    if(drop&&event.distance)effects.push({kind:"drop",cells:event.from,distance:event.distance,color:event.color,at:now,duration:150});
    if(event.rows.length)effects.push({kind:"clear",rows:event.rows,at:now,duration:230});
  }
  const names=["","SINGLE","DOUBLE","TRIPLE","TETRIS"];
  let label=event.spin?`${event.spin} ${names[event.rows.length]}`.trim():names[event.rows.length];
  if(event.perfect)label="PERFECT CLEAR";
  if(event.chained)label+=" · B2B";
  if(label) {$("#event-text").textContent=label;flash(label,now,Boolean(event.spin)||event.rows.length===4||event.perfect);}
  $("#combo-text").textContent=game.combo>0?`COMBO × ${game.combo}`:"COMBO —";
  $("#b2b-text").textContent=game.b2b?"B2B ACTIVE":"B2B —";
  play(drop?"drop":"lock");
  if(event.rows.length||event.spin)play(event.spin||event.rows.length===4||event.perfect?"special":"clear",Math.max(0,game.combo));
  drawPreviews();
  if(mode==="sprint"&&game.lines>=40)finish(true,now);else if(game.over)finish(false,now);
}
function action(name,now=performance.now()) {
  if(!canAct(now))return false;
  let changed=false;
  if(name==="left"||name==="right") {changed=game.move(name==="left"?-1:1,now);if(changed)play("move");}
  if(name==="down") {changed=game.down(now,true);if(changed)play("move");}
  if(name.startsWith("rotate")) {changed=game.rotate(name==="rotate-left"?-1:name==="rotate-180"?2:1,now);if(changed)play("rotate");}
  if(name==="hold") {changed=game.holdPiece(now);if(changed) {play("hold");drawPreviews();if(game.over)finish(false,now);}}
  if(name==="drop") {afterLock(game.hardDrop(now),now,true);changed=true;}
  updateHud();draw(now);armFrame();return changed;
}
function start() {
  sound.unlock();sound.configure(prefs);sound.stopMusic();
  game=new Game();phase="countdown";elapsed=0;countdownAt=performance.now();countdownNumber=3;
  effects=[];feedbackUntil=0;resetInput();
  $("#board-feedback").classList.remove("visible");$("#result").hidden=true;
  $("#event-text").textContent="—";$("#combo-text").textContent="COMBO —";$("#b2b-text").textContent="B2B —";
  $("#overlay").hidden=false;$("#overlay-title").textContent="3";
  $("#overlay-description").textContent=mode==="sprint"?"40줄 기록 도전":"2분 동안 최대 점수에 도전";
  $("#start-button").hidden=true;setModeButtons(true);
  $("#status").textContent="준비하세요. 카운트다운 후 기록 측정이 시작됩니다.";
  play("count");drawPreviews();updateHud();draw(countdownAt);armFrame();
}
function begin(now) {
  // Begin on the rendered GO frame, even after background-tab throttling.
  phase="playing";startedAt=now;game.gravityAt=now;resetInput();
  $("#overlay").hidden=true;$("#status").textContent=mode==="sprint"?"40줄 완주 · 일정한 낙하 속도 · 최고 기록에 도전하세요":"2분 점수 도전 · T스핀과 콤보로 점수를 쌓으세요";
  flash("GO",now);play("go");sound.startMusic();
}
function finish(completed,now=performance.now()) {
  if(phase!=="playing")return;
  elapsed=mode==="attack"?Math.min(ATTACK_MS,Math.max(0,now-startedAt)):Math.max(0,now-startedAt);
  phase="finished";resetInput();sound.stopMusic();setModeButtons(false);
  feedbackUntil=0;$("#board-feedback").classList.remove("visible");
  const previous=bests[mode],eligible=mode==="sprint"?completed:true,candidate=mode==="sprint"?elapsed:game.score;
  const hasPrevious=previous>0||(mode==="attack"&&records.some(r=>r.mode==="attack"));
  const isBest=eligible&&(!hasPrevious||(mode==="sprint"?candidate<previous:candidate>previous));
  if(isBest) {bests[mode]=candidate;write(mode==="sprint"?BEST:ATTACK_BEST,candidate);}
  const record={mode,completed,date:new Date().toISOString(),elapsed,score:game.score,lines:game.lines,pieces:game.pieces,pps:elapsed>0?game.pieces/(elapsed/1000):0,maxCombo:game.maxCombo,tspins:game.tspins,tetrises:game.tetrises,perfects:game.perfects};
  records.unshift(record);const counts={sprint:0,attack:0};records=records.filter(r=>++counts[r.mode]<=10);write(HISTORY,records);
  $("#overlay").hidden=false;$("#overlay-title").textContent=completed?mode==="attack"?"TIME UP":"COMPLETE":"GAME OVER";
  $("#overlay-description").textContent=mode==="sprint"?`${fmt(elapsed)} · ${game.lines} LINES`:`${game.score.toLocaleString()} PTS · ${game.lines} LINES`;
  $("#start-button").hidden=false;$("#start-button").textContent="RETRY";
  $("#status").textContent=isBest?"NEW BEST · 새로운 최고 기록입니다!":completed?"도전 완료 · 아래에서 결과와 최근 기록을 확인하세요.":"도전 종료 · 아래에서 이번 플레이를 확인하세요.";
  renderResult(record,previous,isBest,hasPrevious);renderHistory();updateHud();draw(now);armFrame();play(completed?"win":"lose");
}
function renderResult(r,previous,isBest,hasPrevious) {
  $("#result").hidden=false;$("#result-mode").textContent=r.mode==="sprint"?"40 LINES · RUN REPORT":"TIME ATTACK · RUN REPORT";
  $("#result-title").textContent=isBest?"NEW PERSONAL BEST":r.completed?"CHALLENGE COMPLETE":"RUN FINISHED";
  $("#result-primary").textContent=r.mode==="sprint"?fmt(r.elapsed):`${r.score.toLocaleString()} PTS`;
  let comparison="첫 기록입니다. 다음 도전에서 기록을 비교해보세요.";
  if(r.mode==="sprint"&&!r.completed)comparison=`${r.lines}줄에서 종료 · 40줄을 완주하면 최고 시간에 반영됩니다.`;
  else if(hasPrevious) {
    const delta=r.mode==="sprint"?r.elapsed-previous:r.score-previous;
    comparison=delta===0?"이전 최고 기록과 동률입니다.":r.mode==="sprint"?`이전 최고 기록보다 ${(Math.abs(delta)/1000).toFixed(2)}초 ${delta<0?"단축했습니다":"더 걸렸습니다"}.`:`이전 최고 기록보다 ${Math.abs(delta).toLocaleString()}점 ${delta>0?"높습니다":"낮습니다"}.`;
  }
  if(r.mode==="attack"&&!r.completed)comparison+=" · 블록이 쌓여 조기 종료되었습니다.";
  $("#result-comparison").textContent=comparison;
  const stats=[["플레이 시간",fmt(r.elapsed)],["점수",r.score.toLocaleString()],["삭제한 줄",r.lines],["놓은 블록",r.pieces],["초당 블록",r.pps.toFixed(2)],["최대 콤보",r.maxCombo],["T-SPIN",r.tspins],["TETRIS",r.tetrises],["PERFECT CLEAR",r.perfects]];
  $("#result-stats").replaceChildren(...stats.map(([label,value])=>{const div=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value;div.append(dt,dd);return div;}));
}
function renderHistory() {
  const list=records.filter(r=>r.mode===mode).slice(0,10);
  $("#history-empty").hidden=list.length>0;$("#history-table").hidden=!list.length;
  $("#history-body").replaceChildren(...list.map(r=>{
    const row=document.createElement("tr"),values=[new Date(r.date).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}),r.completed?"완료":"종료",fmt(r.elapsed),r.score.toLocaleString(),r.lines,r.pps.toFixed(2)];
    values.forEach(value=>{const td=document.createElement("td");td.textContent=value;row.append(td);});return row;
  }));storageNotice();
}
function setModeButtons(disabled) {document.querySelectorAll("[data-mode]").forEach(b=>{b.disabled=disabled;});}
function selectMode(next) {
  if(!["ready","finished"].includes(phase)||!["sprint","attack"].includes(next))return;
  mode=next;phase="ready";game=new Game();elapsed=0;effects=[];resetInput();
  $("#game-title").textContent=mode==="sprint"?"40 LINES":"TIME ATTACK";document.title=`${$("#game-title").textContent} · TETRIS`;
  $("#mode-eyebrow").textContent=mode==="sprint"?"SOLO SPRINT · 40 LINE CHALLENGE":"SCORE CHALLENGE · 120 SECONDS";
  $("#time-label").textContent=mode==="sprint"?"TIME":"TIME LEFT";$("#best-label").textContent=mode==="sprint"?"BEST TIME":"BEST SCORE";
  document.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
  $("#result").hidden=true;$("#overlay").hidden=false;$("#overlay-title").textContent="READY";
  $("#overlay-description").textContent=mode==="sprint"?"40줄을 가장 빠르게 지워보세요":"2분 동안 최대 점수에 도전하세요";
  $("#start-button").hidden=false;$("#start-button").textContent="START";
  $("#board-feedback").classList.remove("visible");feedbackUntil=0;
  $("#event-text").textContent="—";$("#combo-text").textContent="COMBO —";$("#b2b-text").textContent="B2B —";
  $("#status").textContent=mode==="sprint"?"40줄 완주 · 일정한 낙하 속도 · 최고 기록에 도전하세요":"2분 점수 도전 · 일정한 낙하 속도 · 최고 점수에 도전하세요";
  drawPreviews();updateHud();renderHistory();draw(performance.now());
}
function updateHud() {
  if(document.body.dataset.phase!==phase)document.body.dataset.phase=phase;
  $("#lines").innerHTML=mode==="sprint"?`${Math.min(game.lines,40)} <small>/ 40</small>`:String(game.lines);
  $("#time").textContent=fmt(mode==="attack"?ATTACK_MS-elapsed:elapsed);$("#score").textContent=game.score.toLocaleString();
  $("#best").textContent=mode==="sprint"?bests.sprint?fmt(bests.sprint):"--:--.--":bests.attack.toLocaleString();
  $("#pps").textContent=elapsed>0?(game.pieces/(elapsed/1000)).toFixed(2):"0.00";
  const progress=$("#progress");progress.max=mode==="sprint"?40:ATTACK_MS;progress.value=mode==="sprint"?Math.min(game.lines,40):elapsed;
  $("#progress-label").textContent=mode==="sprint"?`${Math.max(0,40-game.lines)}줄 남음`:`${Math.ceil((ATTACK_MS-elapsed)/1000)}초 남음`;
  $("#progress-value").textContent=`${Math.floor(progress.value/progress.max*100)}%`;
  $(".board-column").classList.toggle("final-stretch",phase==="playing"&&(mode==="sprint"?game.lines>=30:elapsed>=110000));
}
function drawMini(context,type,w,h) {
  context.clearRect(0,0,w,h);if(!type)return;
  const p=clone(type),occupied=cells(p),minX=Math.min(...occupied.map(c=>c.x)),minY=Math.min(...occupied.map(c=>c.y));
  const cols=Math.max(...occupied.map(c=>c.x))-minX+1,rows=Math.max(...occupied.map(c=>c.y))-minY+1,s=20;
  occupied.forEach(({x,y})=>paintBlock(context,(w-cols*s)/2+(x-minX)*s,(h-rows*s)/2+(y-minY)*s,s,p.c));
}
function drawPreviews() {
  drawMini(holdCtx,game.hold,120,120);$("#hold").style.opacity=game.canHold?"1":".4";
  $("#next-list").replaceChildren(...game.queue.slice(0,5).map(type=>{const c=document.createElement("canvas");c.width=316;c.height=104;c.className="next-item";const context=c.getContext("2d");context.scale(2,2);drawMini(context,type,158,52);return c;}));
}
function paintBlock(context,x,y,size,color,ghost=false) {
  const key=`${prefs.skin}:${color}:${size}:${ghost}`;
  if(!skinTiles.has(key)) {
    const tile=document.createElement("canvas");tile.width=size*2;tile.height=size*2;
    const tileCtx=tile.getContext("2d");tileCtx.scale(2,2);BlockSkins.draw(tileCtx,0,0,size,color,prefs.skin,ghost);skinTiles.set(key,tile);
  }
  context.drawImage(skinTiles.get(key),x,y,size,size);
}
function block(x,y,color) {
  if(y<2)return;const px=x*30,py=(y-2)*30;
  if(color)paintBlock(ctx,px,py,30,color);
  else {ctx.fillStyle="#0d1526";ctx.beginPath();ctx.roundRect(px+1,py+1,28,28,3);ctx.fill();}
}
function draw(now) {
  // The 2px gaps between empty cells reveal this lighter fill as the board grid.
  ctx.clearRect(0,0,300,600);ctx.fillStyle="#33486b";ctx.fillRect(0,0,300,600);
  game.board.forEach((row,y)=>row.forEach((v,x)=>block(x,y,v)));
  if(phase!=="finished"&&!game.over) {
    if(prefs.ghost) {const ghost={...game.current};while(!game.blocked(ghost,0,1))ghost.y++;cells(ghost).forEach(({x,y})=>{if(y>=2)paintBlock(ctx,x*30,(y-2)*30,30,game.current.c,true);});}
    cells(game.current).forEach(({x,y})=>block(x,y,game.current.c));
  }
  effects=effects.filter(e=>now-e.at<e.duration);
  if(prefs.effects)effects.forEach(effect=>{
    const fade=Math.max(0,1-(now-effect.at)/effect.duration);ctx.save();ctx.globalAlpha=fade*(reducedMotion.matches ? .2 : .65);
    if(effect.kind==="clear")effect.rows.forEach(y=>{if(y>=2) {ctx.fillStyle="#d6efff";ctx.fillRect(0,(y-2)*30,300,30);}});
    else if(effect.kind==="lock") {ctx.fillStyle="#ffffff";effect.cells.forEach(({x,y})=>{if(y>=2){ctx.beginPath();ctx.roundRect(x*30+1,(y-2)*30+1,28,28,6);ctx.fill();}});}
    else if(!reducedMotion.matches)effect.cells.forEach(({x,y})=>{
      const top=Math.max(0,(y-2)*30),bottom=(y+effect.distance-1)*30,gradient=ctx.createLinearGradient(0,top,0,Math.max(top+1,bottom));
      gradient.addColorStop(0,"transparent");gradient.addColorStop(1,BlockSkins.color(prefs.skin,effect.color));ctx.fillStyle=gradient;ctx.fillRect(x*30+5,top,20,Math.max(0,bottom-top));
    });ctx.restore();
  });
  if(now>=feedbackUntil)$("#board-feedback").classList.remove("visible");
}
function processHeld(now) {
  if(direction&&now>=repeatAt) {
    if(prefs.arr===0) {while(game.move(direction,now)){}repeatAt=now+16;}
    else {let count=0;while(now>=repeatAt&&count++<10) {if(game.move(direction,now))play("move");repeatAt+=prefs.arr;}if(now>=repeatAt)repeatAt=now+prefs.arr;}
  }
  if(keys.ArrowDown&&now>=softAt) {let count=0;while(now>=softAt&&count++<22) {game.down(now,true);softAt+=35;}if(now>=softAt)softAt=now+35;}
}
function tick(now) {
  frame=null;
  if(phase==="countdown") {
    const count=Math.ceil((COUNTDOWN_MS-(now-countdownAt))/1000);
    if(count<=0)begin(now);else if(count!==countdownNumber) {countdownNumber=count;$("#overlay-title").textContent=String(count);play("count");}
  }
  if(phase==="playing") {
    if(mode==="attack"&&remaining(now)<=0)finish(true,startedAt+ATTACK_MS);
    else {elapsed=Math.max(0,now-startedAt);processHeld(now);afterLock(game.update(now),now);}
  }
  updateHud();draw(now);if(phase==="playing"||phase==="countdown"||effects.length||now<feedbackUntil)armFrame();
}
$("#start-button").onclick=start;$("#restart-button").onclick=start;
$("#result-retry").onclick=()=>{start();$(".board-column").scrollIntoView({block:"center",behavior:"instant"});};
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>selectMode(b.dataset.mode));
document.querySelectorAll("[data-control]").forEach(b=>b.onclick=()=>action(b.dataset.control));
document.addEventListener("keydown",e=>{
  if(dialog.open||skinsDialog.open||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.code==="Space"?"Space":e.key;
  if(["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space"].includes(k)&&phase!=="ready")e.preventDefault();
  if(e.repeat)return;if(k.toLowerCase()==="r") {start();return;}
  const now=performance.now();if(!canAct(now))return;
  const mapped={c:"hold",Shift:"hold",ArrowUp:"rotate-right",x:"rotate-right",z:"rotate-left",a:"rotate-180",Space:"drop"};
  if(mapped[k]||mapped[k.toLowerCase()]) {action(mapped[k]||mapped[k.toLowerCase()],now);return;}
  if(["ArrowLeft","ArrowRight","ArrowDown"].includes(k)) {
    keys[k]=true;
    if(k==="ArrowDown") {action("down",now);softAt=now+35;}
    else {direction=k==="ArrowLeft"?-1:1;action(direction<0?"left":"right",now);repeatAt=now+prefs.das;}
  }
});
document.addEventListener("keyup",e=>{
  keys[e.key]=false;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight") {
    const released=e.key==="ArrowLeft"?-1:1;
    if(released===direction) {direction=keys.ArrowLeft?-1:keys.ArrowRight?1:0;repeatAt=performance.now()+prefs.das;}
  }
});
window.addEventListener("blur",resetInput);document.addEventListener("visibilitychange",()=>{if(document.hidden)resetInput();});
function syncSettings() {
  ["das","arr","sfx","music"].forEach(key=>{$(`#${key}-input`).value=prefs[key];$(`#${key}-value`).textContent=key==="arr"&&prefs.arr===0?"INSTANT":`${prefs[key]}${["das","arr"].includes(key)?" ms":"%"}`;});
  $("#ghost-input").checked=prefs.ghost;$("#mute-input").checked=prefs.muted;$("#effects-input").checked=prefs.effects;sound.configure(prefs);
}
$("#settings-button").onclick=()=>{resetInput();sound.unlock();syncSettings();dialog.showModal();};
["das","arr","sfx","music"].forEach(key=>{$(`#${key}-input`).oninput=e=>{prefs[key]=Number(e.target.value);syncSettings();};});
$("#sfx-input").onchange=()=>play("rotate");
[["ghost","ghost"],["mute","muted"],["effects","effects"]].forEach(([id,key])=>{
  $(`#${id}-input`).onchange=e=>{prefs[key]=e.target.checked;if(!prefs.effects) {effects=[];feedbackUntil=0;}syncSettings();draw(performance.now());};
});
dialog.addEventListener("close",()=>{resetInput();write(SETTINGS,prefs);});
function syncSkinSelection() {
  const skin=BlockSkins.get(prefs.skin);
  $("#current-skin-name").textContent=skin.name;
  $("#skin-selection-status").textContent=`${skin.name} · ${skin.description}`;
  document.querySelectorAll("[data-skin]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.skin===skin.id)));
}
function selectSkin(id) {
  prefs.skin=BlockSkins.get(id).id;skinTiles.clear();resetInput();write(SETTINGS,prefs);
  syncSkinSelection();drawPreviews();draw(performance.now());
}
function buildSkinOptions() {
  $("#skin-options").replaceChildren(...BlockSkins.catalog.map(skin=>{
    const button=document.createElement("button");button.type="button";button.className="skin-option";button.dataset.skin=skin.id;button.setAttribute("aria-label",`${skin.name}: ${skin.description}`);
    const art=document.createElement("span");art.className="skin-art";art.style.background=skin.swatch;
    const c=document.createElement("canvas");c.width=200;c.height=160;c.setAttribute("aria-hidden","true");const context=c.getContext("2d");context.scale(2,2);
    [[1,0],[0,1],[1,1],[2,1]].forEach(([x,y])=>BlockSkins.draw(context,8+x*28,10+y*28,28,"T",skin.id));
    art.append(c);button.append(art);
    [["skin-name",skin.name],["skin-english",skin.english],["skin-tag",skin.tag],["skin-check","✓"]].forEach(([className,text])=>{const span=document.createElement("span");span.className=className;span.textContent=text;if(className==="skin-check")span.setAttribute("aria-hidden","true");button.append(span);});
    button.onclick=()=>selectSkin(skin.id);return button;
  }));syncSkinSelection();
}
$("#skins-button").onclick=()=>{resetInput();$(".skin-playing-note").hidden=!["playing","countdown"].includes(phase);syncSkinSelection();skinsDialog.showModal();};
$("#close-skins").onclick=()=>skinsDialog.close();$("#done-skins").onclick=()=>skinsDialog.close();
skinsDialog.addEventListener("close",resetInput);
buildSkinOptions();
syncSettings();selectMode(new URLSearchParams(location.search).get("mode")==="attack"?"attack":"sprint");
