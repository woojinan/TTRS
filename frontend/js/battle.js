"use strict";
(() => {
  const $=s=>document.querySelector(s),SETTINGS='ttrs-input-settings',NAME='ttrs-online-name';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const saved=read(SETTINGS,{}),audio=new GameAudio();
  const prefs={skin:BlockSkins.get(saved?.skin).id,das:133,arr:10,ghost:saved?.ghost!==false,sfx:65,music:20,muted:saved?.muted===true,effects:saved?.effects!==false};
  for(const [key,max] of [['das',300],['arr',100],['sfx',100],['music',100]])if(Number.isFinite(saved?.[key]))prefs[key]=Math.max(0,Math.min(max,saved[key]));
  let socket=null,selfId=null,room=null,latest=null,seq=0,lastEvent=null,feedbackTimer=null,connectTimer=null,retryTimer=null,closing=false,exitAction=null,lastPong=0;
  const held=new Set(),tiles=new Map();
  const nextCanvases=Array.from({length:5},(_,i)=>{const c=document.createElement('canvas');c.width=316;c.height=104;c.className='next-item';c.setAttribute('aria-label',`다음 ${i+1}번 블록`);return c;});
  $('#duel-next').replaceChildren(...nextCanvases);
  $('#nickname').value=String(read(NAME,'플레이어')).slice(0,16);
  $('#battle-das').value=prefs.das;$('#battle-arr').value=prefs.arr;$('#battle-mute').checked=prefs.muted;
  $('#battle-skin').replaceChildren(...BlockSkins.catalog.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.name} · ${s.english}`;return o;}));$('#battle-skin').value=prefs.skin;
  const invite=new URLSearchParams(location.search).get('room');if(invite)$('#join-code').value=invite.toUpperCase().slice(0,6);
  const connected=()=>socket?.readyState===WebSocket.OPEN&&Boolean(selfId);
  const playing=()=>room?.phase==='playing';
  const active=()=>['playing','countdown'].includes(room?.phase);
  function notify(text){$('#notice').hidden=!text;$('#notice').textContent=text;}
  function send(message){if(!connected())return false;socket.send(JSON.stringify(message));return true;}
  function input(action,edge='tap') {if(!playing())return;send({type:'input',match:room.match,seq:++seq,action,edge});}
  function release(){held.clear();input('release');}
  function config(){
    prefs.skin=$('#battle-skin').value;
    for(const [key,max,fallback] of [['das',300,133],['arr',100,10]]){const v=Number($(`#battle-${key}`).value);prefs[key]=Number.isFinite(v)?Math.max(0,Math.min(max,v)):fallback;$(`#battle-${key}`).value=prefs[key];}
    write(SETTINGS,{...read(SETTINGS,{}),...prefs});write(NAME,$('#nickname').value.trim()||'플레이어');audio.configure(prefs);
    return {name:$('#nickname').value,skin:prefs.skin,das:prefs.das,arr:prefs.arr};
  }
  function connection(ok,text){document.body.dataset.connected=String(ok);$('#connection-status').textContent=text;$('#create-room').disabled=!ok;$('#join-room').disabled=!ok;$('#refresh-rooms').disabled=!ok;$('#reconnect').hidden=ok;}
  function connect(){
    clearTimeout(retryTimer);clearTimeout(connectTimer);selfId=null;connection(false,'서버 연결 중…');$('#reconnect').hidden=true;
    const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws/battle`);socket=ws;
    connectTimer=setTimeout(()=>{if(!selfId&&socket===ws)ws.close();},8000);
    ws.onmessage=event=>{if(socket!==ws)return;try{receive(JSON.parse(event.data));}catch(error){console.error(error);notify('서버 메시지를 처리하지 못했습니다. 다시 연결해 주세요.');}};
    ws.onclose=()=>{
      if(socket!==ws)return;clearTimeout(connectTimer);selfId=null;audio.stopMusic();held.clear();
      if(room)notify('서버 연결이 끊겨 방에서 나왔습니다. 진행 중이던 대결은 접속 종료 패배로 처리됩니다.');
      showLobby();connection(false,'연결 끊김 · 재접속 중');
      if(!closing)retryTimer=setTimeout(connect,3000);
    };
    ws.onerror=()=>connection(false,'서버에 연결할 수 없습니다');
  }
  function showLobby(){room=null;latest=null;lastEvent=null;$('#room').hidden=true;$('#lobby').hidden=false;$('#chat-messages').replaceChildren();$('#exit-dialog').close();audio.stopMusic();document.title='ONLINE DUEL · TTRS';}
  function receive(m){
    if(m.type==='hello'){selfId=m.id;lastPong=performance.now();clearTimeout(connectTimer);connection(true,'온라인');return;}
    if(m.type==='pong'){lastPong=performance.now();const ms=Math.round(performance.now()-m.at);connection(true,`온라인 · ${Math.max(0,ms)} ms`);return;}
    if(m.type==='error'){notify(m.message);return;}
    if(m.type==='rooms'){renderRooms(m.rooms);return;}
    if(m.type==='joined'){
      notify('');$('#lobby').hidden=true;$('#room').hidden=false;$('#chat-messages').replaceChildren();latest=null;lastEvent=null;
      systemMessage('친구에게 방 코드나 초대 링크를 공유하세요.');for(const entry of m.chat)addChat(entry);
      renderBoard($('#self-board'),null);renderBoard($('#opponent-board'),null);renderPreviews(null);return;
    }
    if(m.type==='left'){showLobby();notify('');return;}
    if(m.type==='room'){
      const previous=room;room=m;$('#active-room-title').textContent=m.title;$('#room-code').textContent=m.code;document.title=`${m.title} · TTRS`;
      const mine=m.players.find(p=>p.id===selfId),other=m.players.find(p=>p.id!==selfId);
      $('#self-name').textContent=mine?.name||'나';$('#opponent-name').textContent=other?.name||'참가 대기 중';
      for(const [prefix,p] of [['self',mine],['opponent',other]]){const badge=$(`#${prefix}-ready`);badge.textContent=p?(p.ready?'준비 완료':active()?'대결 중':'대기'):'빈자리';badge.dataset.ready=String(Boolean(p?.ready));}
      $('#ready-button').hidden=active();$('#ready-button').textContent=mine?.ready?'준비 취소':m.phase==='finished'?'다시 준비':'준비 완료';$('#ready-button').disabled=!mine;
      $('#forfeit-button').hidden=!active();
      if(previous&&previous.players.length>m.players.length)systemMessage('상대가 방을 나갔습니다. 새 상대를 기다립니다.');
      if(!other)renderBoard($('#opponent-board'),null);
      if(m.match!==previous?.match){seq=0;lastEvent=null;release();}
      if(m.phase==='finished'&&previous?.phase!=='finished'){audio.stopMusic();held.clear();audio.play(m.result?.winner===selfId?'win':'lose');systemMessage(resultText(m.result));}
      if(m.phase==='playing'&&previous?.phase!=='playing'){
        held.clear();audio.play('go');audio.startMusic();
        if(innerWidth<=620)$('#self-board').scrollIntoView({block:'center',behavior:'instant'});
      }
      renderPhase();return;
    }
    if(m.type==='state'){
      latest=m;
      const mine=m.players.find(p=>p.id===selfId),other=m.players.find(p=>p.id!==selfId);
      renderBoard($('#self-board'),mine,true);renderBoard($('#opponent-board'),other);renderPreviews(mine);
      for(const field of ['sent','lines','pending'])$(`#self-${field}`).textContent=String(mine?.[field]||0);
      $('#self-pps').textContent=m.elapsed>0?((mine?.pieces||0)/(m.elapsed/1000)).toFixed(2):'0.00';$('#garbage-meter').value=Math.min(20,mine?.pending||0);
      $('#self-garbage-hint').textContent=mine?.mature?'다음 미삭제 착지 때 상승':mine?.pending?'공격 예고 · 지금 상쇄하세요':'공격하면 먼저 상쇄돼요';
      const e=mine?.event;if(e&&e.id!==lastEvent){lastEvent=e.id;if(e.action==='lock'){audio.play(e.lines?'clear':'drop');if(prefs.effects){$('#self-feedback').textContent=eventText(e);clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('#self-feedback').textContent='',900);}}}
      renderPhase();return;
    }
    if(m.type==='chat'){addChat(m);return;}
    if(m.type==='expired'||m.type==='server_closed'){notify('연결이 종료되었습니다. 다시 연결하고 방에 참가해 주세요.');socket.close();}
  }
  function resultText(result){
    if(!result)return '대결 종료';
    const outcome=!result.winner?'무승부':result.winner===selfId?'승리!':'패배';
    const reasons={topout:'보드가 가득 찼습니다',forfeit:'기권으로 종료',leave:'방 나가기로 종료',disconnect:'접속 종료'};
    return `${outcome} · ${reasons[result.reason]||'대결 종료'}`;
  }
  function renderPhase(){
    if(!room)return;const p=room.phase;
    $('#match-time').textContent=fmt(latest?.match===room.match?latest.elapsed:0);
    $('#duel-overlay').hidden=p==='playing';
    let title,desc,overlay;
    if(p==='waiting'){title=room.players.length<2?'상대를 기다리는 중':'준비되면 시작하세요';desc='두 명 모두 준비하면 3초 후 동시에 시작됩니다.';overlay='READY';}
    if(p==='countdown'){overlay=String(Math.max(1,Math.ceil((latest?.countdown??3000)/1000)));title='곧 시작합니다';desc='같은 블록 순서 · 끝까지 살아남으세요.';}
    if(p==='playing'){title='대결 진행 중';desc='공격으로 상쇄하고, 빈틈을 노리세요.';}
    if(p==='finished'){title=resultText(room.result);desc=room.players.length===2?'둘 다 다시 준비하면 재대결합니다.':'새 상대가 참가하면 다시 대결할 수 있습니다.';overlay=!room.result?.winner?'DRAW':room.result.winner===selfId?'YOU WIN':'YOU LOSE';}
    $('#match-title').textContent=title||'';$('#match-description').textContent=desc||'';$('#duel-countdown').textContent=overlay||'';$('#duel-overlay-description').textContent=desc||'';
  }
  function fmt(ms){const s=Math.floor(Math.max(0,ms||0)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function eventText(e){if(e.perfect)return `PERFECT CLEAR · +${e.outgoing}`;const clear=e.spin||['','SINGLE','DOUBLE','TRIPLE','TETRIS'][e.lines]||'';return [clear,e.chained?'B2B':'',e.combo>0?`COMBO ${e.combo}`:'',e.outgoing?`공격 +${e.outgoing}`:'',e.cancelled?`${e.cancelled}줄 상쇄`:'',e.risen?`${e.risen}줄 상승`:''].filter(Boolean).join(' · ');}
  function tile(ctx,x,y,size,color,skin,ghost=false){
    if(color==='#647580'){ctx.fillStyle='#7e91ae';ctx.beginPath();ctx.roundRect(x+1,y+1,size-2,size-2,3);ctx.fill();ctx.strokeStyle='#adbed6';ctx.lineWidth=1;ctx.stroke();return;}
    const key=[size,color,skin,ghost].join(':');if(!tiles.has(key)){const c=document.createElement('canvas');c.width=size*2;c.height=size*2;const g=c.getContext('2d');g.scale(2,2);BlockSkins.draw(g,0,0,size,color,skin,ghost);tiles.set(key,c);}ctx.drawImage(tiles.get(key),x,y,size,size);
  }
  function renderBoard(canvas,p,own=false){
    const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#33486b';ctx.fillRect(0,0,300,600);
    for(let y=0;y<20;y++)for(let x=0;x<10;x++){ctx.fillStyle='#0d1526';ctx.beginPath();ctx.roundRect(x*30+1,y*30+1,28,28,3);ctx.fill();const v=p?.board?.[y+2]?.[x];if(v)tile(ctx,x*30,y*30,30,v,p.skin);}
    if(!p?.current||p.over)return;
    if(own&&prefs.ghost){const g=Object.assign(Object.create(Tetris.Game.prototype),{board:p.board,current:p.current}),ghost={...p.current};let n=0;while(!g.blocked(ghost,0,1)&&n++<22)ghost.y++;for(const {x,y} of Tetris.cells(ghost))if(y>=2)tile(ctx,x*30,(y-2)*30,30,p.current.c,p.skin,true);}
    for(const {x,y} of Tetris.cells(p.current))if(y>=2)tile(ctx,x*30,(y-2)*30,30,p.current.c,p.skin);
  }
  function renderPreviews(p){
    // Match solo preview dimensions and 20px tiles; reuse canvases on state updates.
    const draw=(c,type)=>{const ctx=c.getContext('2d'),w=c.width/2,h=c.height/2,size=20;ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,w,h);c.dataset.piece=type||'';if(!type)return;
      const piece=Tetris.clone(type),cells=Tetris.cells(piece),minX=Math.min(...cells.map(v=>v.x)),minY=Math.min(...cells.map(v=>v.y)),cols=Math.max(...cells.map(v=>v.x))-minX+1,rows=Math.max(...cells.map(v=>v.y))-minY+1;
      for(const {x,y} of cells)tile(ctx,(w-cols*size)/2+(x-minX)*size,(h-rows*size)/2+(y-minY)*size,size,piece.c,p.skin);
    };
    draw($('#duel-hold'),p?.hold);nextCanvases.forEach((c,i)=>draw(c,p?.queue?.[i]));
    $('#duel-hold').style.opacity=p?.canHold?'1':'.4';
  }
  function renderRooms(rooms){
    $('#rooms-empty').hidden=rooms.length>0;$('#room-list').replaceChildren(...rooms.map(r=>{const row=document.createElement('div');row.className='room-row';const info=document.createElement('div'),name=document.createElement('strong'),code=document.createElement('small'),count=document.createElement('span'),button=document.createElement('button');name.textContent=r.title;code.textContent=`${r.code} · ${['playing','countdown'].includes(r.phase)?'대결 중':'대기 중'}`;info.append(name,code);count.textContent=`${r.count} / 2`;button.type='button';button.textContent='참가';button.disabled=r.count>=2||['playing','countdown'].includes(r.phase);button.onclick=()=>join(r.code);row.append(info,count,button);return row;}));
  }
  function systemMessage(text){const p=document.createElement('p');p.className='chat-system';p.textContent=text;$('#chat-messages').append(p);trimChat();}
  function addChat(m){const log=$('#chat-messages'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;const p=document.createElement('p'),name=document.createElement('strong'),body=document.createElement('span');p.className=`chat-message${m.id===selfId?' mine':''}`;name.textContent=m.name;body.textContent=m.text;p.append(name,body);log.append(p);trimChat();if(bottom||m.id===selfId)log.scrollTop=log.scrollHeight;}
  function trimChat(){const log=$('#chat-messages');while(log.children.length>60)log.firstChild.remove();}
  function join(code){notify('');send({type:'join',code,...config()});}
  $('#create-form').onsubmit=e=>{e.preventDefault();notify('');send({type:'create',title:$('#room-title').value,...config()});};
  $('#join-form').onsubmit=e=>{e.preventDefault();join($('#join-code').value);};$('#refresh-rooms').onclick=()=>send({type:'list'});
  $('#reconnect').onclick=()=>{if(socket)socket.onclose=null;socket?.close();connect();};
  $('#ready-button').onclick=e=>{config();audio.unlock();audio.configure(prefs);release();send({type:'ready',ready:!room.players.find(p=>p.id===selfId)?.ready,...config()});e.currentTarget.blur();};
  function requestExit(action){release();if(active()){exitAction=action;$('#confirm-exit').textContent=action==='leave'?'기권하고 나가기':'기권하기';$('#exit-dialog').showModal();}else send({type:action});}
  $('#leave-room').onclick=()=>requestExit('leave');$('#forfeit-button').onclick=()=>requestExit('forfeit');
  $('#exit-dialog').addEventListener('close',()=>{release();if($('#exit-dialog').returnValue==='confirm'&&exitAction)send({type:exitAction});exitAction=null;});
  $('#copy-invite').onclick=async()=>{if(!room)return;const url=new URL('/battle',location.href);url.searchParams.set('room',room.code);try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url.href);notify('초대 링크를 복사했습니다. 친구에게 보내 주세요.');}catch{notify(`초대 주소: ${url.href} · 방 코드 ${room.code}`);}};
  $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-input').value.trim();if(text&&send({type:'chat',text}))$('#chat-input').value='';};
  $('#battle-mute').onchange=e=>{prefs.muted=e.target.checked;audio.configure(prefs);write(SETTINGS,{...read(SETTINGS,{}),muted:prefs.muted});};
  $('#battle-skin').onchange=config;
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate-right',KeyX:'rotate-right',KeyZ:'rotate-left',KeyA:'rotate-180',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold',Space:'drop'};
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.altKey||e.metaKey||$('#exit-dialog').open)return;
    if(e.target.matches('input,textarea,select')){if(e.code==='Escape'){e.target.blur();release();}return;}
    if(e.code==='Enter'&&room){e.preventDefault();release();$('#chat-input').focus();return;}
    const action=keyMap[e.code];if(!playing()||!action)return;e.preventDefault();if(e.repeat||held.has(action))return;held.add(action);input(action,'down');audio.play(action.startsWith('rotate')?'rotate':action==='hold'?'hold':'move');
  });
  document.addEventListener('keyup',e=>{const a=keyMap[e.code];if(a&&held.has(a)){held.delete(a);input(a,'up');}});
  document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))release();});
  window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  document.querySelectorAll('[data-action]').forEach(b=>{
    b.onpointerdown=e=>{e.preventDefault();if(!playing())return;b.setPointerCapture(e.pointerId);const a=b.dataset.action;held.add(a);input(a,'down');};
    const up=()=>{const a=b.dataset.action;if(held.has(a)){held.delete(a);input(a,'up');}};b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up;
    b.onclick=e=>{if(e.detail===0)input(b.dataset.action);};
  });
  window.addEventListener('pagehide',()=>{closing=true;clearTimeout(retryTimer);send({type:'leave'});socket?.close();});
  setInterval(()=>{if(connected()){if(performance.now()-lastPong>15000){connection(false,'연결 지연 · 확인 중');socket.close();}else send({type:'ping',at:performance.now()});}},5000);
  connect();
})();
