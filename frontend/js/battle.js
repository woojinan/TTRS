"use strict";
(() => {
  const $=s=>document.querySelector(s),SETTINGS='ttrs-input-settings',NAME='ttrs-online-name';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const saved=read(SETTINGS,{}),audio=new GameAudio();
  const prefs=TTRSPreferences.normalize(saved);
  let socket=null,selfId=null,room=null,latest=null,seq=0,lastEvent=null,feedbackTimer=null,connectTimer=null,retryTimer=null,closing=false,exitAction=null,lastPong=0;
  const held=new Set(),tiles=new Map();
  const nextCanvases=Array.from({length:5},(_,i)=>{const c=document.createElement('canvas');c.width=316;c.height=104;c.className='next-item';c.setAttribute('aria-label',`다음 ${i+1}번 블록`);return c;});
  $('#duel-next').replaceChildren(...nextCanvases);
  $('#nickname').value=String(read(NAME,'플레이어')).slice(0,16);
  $('#battle-das').value=prefs.das;$('#battle-arr').value=prefs.arr;$('#battle-mute').checked=prefs.muted;
  $('#battle-skin').replaceChildren(...BlockSkins.catalog.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.name} · ${s.english}`;return o;}));$('#battle-skin').value=prefs.skin;
  const invite=new URLSearchParams(location.search).get('room');if(invite)$('#join-code').value=invite.toUpperCase().slice(0,6);
  const connected=()=>socket?.readyState===WebSocket.OPEN&&Boolean(selfId);
  const playing=()=>room?.phase==='playing'&&!latest?.players.find(p=>p.id===selfId)?.eliminated;
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
  function showLobby(){room=null;latest=null;lastEvent=null;$('#room').hidden=true;$('#lobby').hidden=false;$('#chat-messages').replaceChildren();$('#exit-dialog').close();audio.stopMusic();document.title='ARENA 50 · TTRS';}
  function receive(m){
    if(m.type==='hello'){selfId=m.id;$('#nickname').value=m.name;$('#room-title').placeholder=`${m.name}s_room`;lastPong=performance.now();clearTimeout(connectTimer);connection(true,'온라인');return;}
    if(m.type==='duplicate'){closing=true;clearTimeout(retryTimer);clearTimeout(connectTimer);socket.onclose=null;socket.close();connection(false,'다른 탭에서 접속 중');return;}
    if(m.type==='pong'){lastPong=performance.now();const ms=Math.round(performance.now()-m.at);connection(true,`온라인 · ${Math.max(0,ms)} ms`);return;}
    if(m.type==='error'){notify(m.message);return;}
    if(m.type==='rooms'){renderRooms(m.rooms);return;}
    if(m.type==='joined'){
      notify('');$('#lobby').hidden=true;$('#room').hidden=false;$('#chat-messages').replaceChildren();latest=null;lastEvent=null;
      systemMessage('친구에게 방 코드나 초대 링크를 공유하세요.');for(const entry of m.chat)addChat(entry);
      TTRSGarbage.render(0,0);renderBoard($('#self-board'),null);$('#opponent-boards').replaceChildren();renderPreviews(null);return;
    }
    if(m.type==='left'){showLobby();notify('');return;}
    if(m.type==='room'){
      const previous=room;room=m;$('#active-room-title').textContent=m.title;$('#room-code').textContent=m.code;document.title=`${m.title} · TTRS`;
      const mine=m.players.find(p=>p.id===selfId),other=m.players.find(p=>p.id!==selfId);
      $('#self-name').textContent=mine?.name||'나';
      for(const [prefix,p] of [['self',mine]]){const badge=$(`#${prefix}-ready`);badge.textContent=p?(p.id===m.host&&!active()?'방장':p.ready?'준비 완료':active()?'대결 중':'대기'):'빈자리';badge.dataset.ready=String(Boolean(p?.ready));}
      $('#ready-button').hidden=active()||m.host===selfId;$('#ready-button').textContent=mine?.ready?'준비 취소':m.phase==='finished'?'다시 준비':'준비 완료';$('#ready-button').disabled=!mine;
      $('#forfeit-button').hidden=!active()||mine?.eliminated;
      $('#start-match').hidden=active()||m.host!==selfId;$('#start-match').disabled=!m.players.some(p=>p.id!==m.host&&p.ready);
      if(!active())renderRoster(m.players);
      if(previous&&previous.players.length>m.players.length)systemMessage('상대가 방을 나갔습니다. 새 상대를 기다립니다.');
      if(!other)$('#opponent-boards').replaceChildren();
      if(m.match!==previous?.match){seq=0;lastEvent=null;release();}
      if(m.phase==='finished'&&previous?.phase!=='finished'){audio.stopMusic();held.clear();audio.play(m.result?.winner===selfId?'win':'lose');systemMessage(resultText(m.result));}
      if(m.phase==='playing'&&previous?.phase!=='playing'){
        held.clear();audio.play('go');audio.startMusic();
      }
      renderPhase();return;
    }
    if(m.type==='state'){
      latest=m;
      const mine=m.players.find(p=>p.id===selfId),other=m.players.find(p=>p.id!==selfId);
      $('#alive-count').textContent=`${m.alive} / ${m.total} 생존`;
      $('#forfeit-button').hidden=!active()||mine?.eliminated;
      if(mine?.eliminated){held.clear();audio.stopMusic();}
      renderRoster(m.roster||m.players);
      renderBoard($('#self-board'),mine,true);renderMiniatures(latest?.roster||[]);renderPreviews(mine);
      for(const field of ['sent','lines','pending'])$(`#self-${field}`).textContent=String(mine?.[field]||0);
      $('#self-pps').textContent=m.elapsed>0?((mine?.pieces||0)/(m.elapsed/1000)).toFixed(2):'0.00';$('#garbage-meter').value=Math.min(20,mine?.pending||0);TTRSGarbage.render(m.phase==='playing'&&!mine?.eliminated?mine?.pending:0,mine?.mature||0);
      $('#self-garbage-hint').textContent=mine?.mature?`다음 미삭제 착지 최대 ${Math.min(8,mine.mature)}줄 · 총 대기 ${mine.pending}줄`:mine?.pending?'공격 예고 · 지금 상쇄하세요':'공격하면 먼저 상쇄돼요';
      const e=mine?.event;if(e&&e.id!==lastEvent){lastEvent=e.id;if(e.action==='lock'){audio.play(e.lines?'clear':'drop');if(prefs.effects){$('#self-feedback').textContent=eventText(e);clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('#self-feedback').textContent='',900);}}}
      renderPhase();return;
    }
    if(m.type==='chat'){addChat(m);return;}
    if(m.type==='expired'||m.type==='server_closed'){notify('연결이 종료되었습니다. 다시 연결하고 방에 참가해 주세요.');socket.close();}
  }
  function resultText(result){
    if(!result)return '대결 종료';
    const place=result.standings?.find(p=>p.id===selfId)?.placement;
    const outcome=!result.winner?'무승부':result.winner===selfId?'승리!':`${place||'—'}위 · 대결 종료`;
    const reasons={topout:'보드가 가득 찼습니다',forfeit:'기권으로 종료',leave:'방 나가기로 종료',disconnect:'접속 종료'};
    return `${outcome} · ${reasons[result.reason]||'대결 종료'}`;
  }
  function renderPhase(){
    if(!room)return;const p=room.phase;
    $('#match-time').textContent=fmt(latest?.match===room.match?latest.elapsed:0);
    const eliminated=latest?.players.find(p=>p.id===selfId)?.eliminated;
    $('#duel-overlay').hidden=p==='playing'&&!eliminated;
    let title,desc,overlay;
    if(p==='waiting'){title=room.players.length<2?'상대를 기다리는 중':'준비되면 시작하세요';desc='참가자 한 명 이상 준비하면 방장이 시작합니다. 시작 시 방 인원 모두 참가합니다.';overlay='READY';}
    if(p==='countdown'){overlay=String(Math.max(1,Math.ceil((latest?.countdown??3000)/1000)));title='곧 시작합니다';desc='같은 블록 순서 · 끝까지 살아남으세요.';}
    if(p==='playing'){title=eliminated?'탈락 · 관전 중':'대결 진행 중';desc=eliminated?'남은 플레이어의 대결을 지켜보세요.':'공격줄은 다른 생존자 한 명에게 무작위로 전달됩니다.';if(eliminated)overlay=`${latest.players.find(p=>p.id===selfId)?.placement}위`;}
    if(p==='finished'){title=resultText(room.result);desc='참가자 한 명 이상 다시 준비하면 방장이 재대결을 시작합니다.';overlay=!room.result?.winner?'DRAW':room.result.winner===selfId?'YOU WIN':'FINISHED';}
    $('#arena-result').hidden=p!=='finished';
    if(p==='finished')$('#arena-standings').replaceChildren(...(room.result?.standings||[]).map(p=>{const li=document.createElement('li');li.textContent=`${p.placement}위 · ${p.name} · ${p.lines}줄 / 공격 ${p.sent}`;return li;}));
    $('#match-title').textContent=title||'';$('#match-description').textContent=desc||'';$('#duel-countdown').textContent=overlay||'';$('#duel-overlay-description').textContent=desc||'';
  }
  function fmt(ms){const s=Math.floor(Math.max(0,ms||0)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function renderRoster(players){const box=$('#player-roster'),ids=new Set(players.map(p=>p.id));for(const b of [...box.children])if(!ids.has(b.dataset.player))b.remove();
    for(const p of players){let b=[...box.children].find(b=>b.dataset.player===p.id);if(!b){b=document.createElement('span');b.dataset.player=p.id;box.append(b);}b.textContent=`${p.id===room?.host?'♛ ':''}${p.name} · ${p.eliminated?p.placement+'위':active()?'생존':p.ready?'준비':'대기'}`;b.dataset.eliminated=String(Boolean(p.eliminated));}
  }
  function renderMiniatures(players){const box=$('#opponent-boards'),others=players.filter(p=>p.id!==selfId),ids=new Set(others.map(p=>p.id));for(const card of [...box.children])if(!ids.has(card.dataset.player))card.remove();
    for(const p of others){let card=[...box.children].find(c=>c.dataset.player===p.id);if(!card){card=document.createElement('figure');card.dataset.player=p.id;const c=document.createElement('canvas');c.width=100;c.height=200;c.setAttribute('aria-label',p.name+' 보드');card.append(c,document.createElement('figcaption'));box.append(card);}card.dataset.eliminated=String(Boolean(p.eliminated));card.lastChild.textContent=p.name+(p.eliminated?' · '+p.placement+'위':'');card.title=card.lastChild.textContent;
      const encoded=p.mini||'.'.repeat(200),c=card.firstChild,signature=encoded+p.skin;if(c.dataset.state===signature)continue;c.dataset.state=signature;const ctx=c.getContext('2d');ctx.fillStyle='#15243c';ctx.fillRect(0,0,100,200);for(let i=0;i<200;i++){const v=encoded[i];if(!v||v==='.')continue;ctx.fillStyle=v==='G'?'#92a5bc':BlockSkins.color(p.skin,Tetris.PIECES[v]?.c||'#92a5bc');ctx.fillRect((i%10)*10,Math.floor(i/10)*10,10,10);}
    }
  }
  function eventText(e){if(e.perfect)return `PERFECT CLEAR · +${e.outgoing}`;const clear=e.spin||['','SINGLE','DOUBLE','TRIPLE','TETRIS'][e.lines]||'';return [clear,e.chained?'B2B':'',e.combo>0?`COMBO ${e.combo}`:'',e.outgoing?`공격 +${e.outgoing}`:'',e.cancelled?`${e.cancelled}줄 상쇄`:'',e.risen?`${e.risen}줄 상승`:''].filter(Boolean).join(' · ');}
  function tile(ctx,x,y,size,color,skin,ghost=false){
    if(color==='#647580'){ctx.fillStyle='#7e91ae';ctx.beginPath();ctx.roundRect(x+1,y+1,size-2,size-2,3);ctx.fill();ctx.strokeStyle='#adbed6';ctx.lineWidth=1;ctx.stroke();return;}
    const key=[size,color,skin,ghost,ghost?prefs.ghostOpacity:0].join(':');if(!tiles.has(key)){const c=document.createElement('canvas');c.width=size*2;c.height=size*2;const g=c.getContext('2d');g.scale(2,2);BlockSkins.draw(g,0,0,size,color,skin,ghost,prefs.ghostOpacity);tiles.set(key,c);}ctx.drawImage(tiles.get(key),x,y,size,size);
  }
  function renderBoard(canvas,p,own=false){
    const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle=TTRSPreferences.gridColor(prefs);ctx.fillRect(0,0,300,600);
    for(let y=0;y<20;y++)for(let x=0;x<10;x++){ctx.fillStyle=TTRSPreferences.background(prefs);ctx.beginPath();ctx.roundRect(x*30+1,y*30+1,28,28,3);ctx.fill();const v=p?.board?.[y+2]?.[x];if(v)tile(ctx,x*30,y*30,30,v,p.skin);}
    if(!p?.current||p.over)return;
    if(own&&prefs.ghost){const g=Object.assign(Object.create(Tetris.Game.prototype),{board:p.board,current:p.current}),ghost={...p.current};while(!g.blocked(ghost,0,1))ghost.y++;for(const {x,y} of Tetris.cells(ghost))if(y>=2)tile(ctx,x*30,(y-2)*30,30,p.current.c,p.skin,true);}
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
    $('#rooms-empty').hidden=rooms.length>0;$('#room-list').replaceChildren(...rooms.map(r=>{const row=document.createElement('div');row.className='room-row';const info=document.createElement('div'),name=document.createElement('strong'),code=document.createElement('small'),count=document.createElement('span'),button=document.createElement('button');name.textContent=r.title;code.textContent=`${r.code} · ${['playing','countdown'].includes(r.phase)?'대결 중':'대기 중'}`;info.append(name,code);count.textContent=`${r.count} / 50`;button.type='button';button.textContent='참가';button.disabled=r.count>=50||['playing','countdown'].includes(r.phase);button.onclick=()=>join(r.code);row.append(info,count,button);return row;}));
  }
  function systemMessage(text){const p=document.createElement('p');p.className='chat-system';p.textContent=text;$('#chat-messages').append(p);trimChat();}
  function addChat(m){const log=$('#chat-messages'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;const p=document.createElement('p'),name=document.createElement('strong'),body=document.createElement('span');p.className=`chat-message${m.id===selfId?' mine':''}`;name.textContent=m.name;body.textContent=m.text;p.append(name,body);log.append(p);trimChat();if(bottom||m.id===selfId)log.scrollTop=log.scrollHeight;}
  function trimChat(){const log=$('#chat-messages');while(log.children.length>100)log.firstChild.remove();}
  function join(code){notify('');send({type:'join',code,...config()});}
  $('#create-form').onsubmit=e=>{e.preventDefault();notify('');send({type:'create',title:$('#room-title').value,...config()});};
  $('#join-form').onsubmit=e=>{e.preventDefault();join($('#join-code').value);};$('#refresh-rooms').onclick=()=>send({type:'list'});
  $('#reconnect').onclick=()=>{if(socket)socket.onclose=null;socket?.close();connect();};
  $('#ready-button').onclick=e=>{config();audio.unlock();audio.configure(prefs);release();send({type:'ready',ready:!room.players.find(p=>p.id===selfId)?.ready,...config()});e.currentTarget.blur();};
  $('#start-match').onclick=e=>{audio.unlock();config();release();send({type:'settings',...config()});send({type:'start'});e.currentTarget.blur();};
  function requestExit(action){release();if(active()){exitAction=action;$('#confirm-exit').textContent=action==='leave'?'기권하고 나가기':'기권하기';$('#exit-dialog').showModal();}else send({type:action});}
  $('#leave-room').onclick=()=>requestExit('leave');$('#forfeit-button').onclick=()=>requestExit('forfeit');
  $('#exit-dialog').addEventListener('close',()=>{release();if($('#exit-dialog').returnValue==='confirm'&&exitAction)send({type:exitAction});exitAction=null;});
  $('#copy-invite').onclick=async()=>{if(!room)return;const url=new URL('/battle',location.href);url.searchParams.set('room',room.code);try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url.href);notify('초대 링크를 복사했습니다. 친구에게 보내 주세요.');}catch{notify(`초대 주소: ${url.href} · 방 코드 ${room.code}`);}};
  $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-input').value.trim();if(text&&send({type:'chat',text}))$('#chat-input').value='';};
  $('#battle-mute').onchange=e=>{prefs.muted=e.target.checked;audio.configure(prefs);write(SETTINGS,{...read(SETTINGS,{}),muted:prefs.muted});};
  $('#battle-skin').onchange=config;
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate-right',KeyX:'rotate-right',KeyZ:'rotate-left',KeyA:'rotate-180',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold',Space:'drop'};
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.altKey||e.metaKey||$('#exit-dialog').open||document.body.classList.contains('resizing'))return;
    if(e.target.matches('input,textarea,select')){if(e.code==='Escape'){e.target.blur();release();}return;}
    if(e.code==='Enter'&&room){e.preventDefault();release();$('#chat-input').focus();return;}
    const action=keyMap[e.code];if(!playing()||!action)return;e.preventDefault();if(e.repeat||held.has(action))return;held.add(action);input(action,'down');audio.play(action.startsWith('rotate')?'rotate':action==='hold'?'hold':'move');
  });
  document.addEventListener('keyup',e=>{const a=keyMap[e.code];if(a&&held.has(a)){held.delete(a);input(a,'up');}});
  document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))release();});
  window.addEventListener('blur',release);window.addEventListener('ttrs-resize-start',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  const emoji=[['😊','미소'],['🥰','사랑'],['😂','웃음'],['😎','멋짐'],['🥺','부탁'],['😭','눈물'],['😮','놀람'],['🤔','생각'],['🐰','토끼'],['🐱','고양이'],['🐼','판다'],['🐣','병아리'],['👍','최고'],['👏','박수'],['🎉','축하'],['💙','파란 하트']];
  $('#emoji-picker').replaceChildren(...emoji.map(([face,label])=>{const b=document.createElement('button');b.type='button';b.textContent=face;b.setAttribute('aria-label',label);b.onclick=()=>{const field=$('#chat-input');if(field.value.length+face.length<=200)field.setRangeText(face,field.selectionStart??field.value.length,field.selectionEnd??field.value.length,'end');$('#emoji-picker').hidden=true;$('#emoji-toggle').setAttribute('aria-expanded','false');field.focus();release();};return b;}));
  $('#emoji-toggle').onclick=()=>{release();const picker=$('#emoji-picker');picker.hidden=!picker.hidden;$('#emoji-toggle').setAttribute('aria-expanded',String(!picker.hidden));};
  document.addEventListener('keydown',e=>{if(e.code==='Escape'){$('#emoji-picker').hidden=true;$('#emoji-toggle').setAttribute('aria-expanded','false');}});
  window.addEventListener('ttrs-auth-change',()=>{closing=true;release();socket?.close();notify('계정이 변경되었습니다. 새로고침해 주세요.');});
  window.addEventListener('pagehide',()=>{closing=true;clearTimeout(retryTimer);send({type:'leave'});socket?.close();});
  window.addEventListener('storage',e=>{
    if(e.key!==SETTINGS&&e.key!==null)return;
    Object.assign(prefs,TTRSPreferences.load());tiles.clear();release();audio.configure(prefs);
    if(!prefs.effects){clearTimeout(feedbackTimer);$('#self-feedback').textContent='';}
    $('#battle-skin').value=prefs.skin;$('#battle-das').value=prefs.das;$('#battle-arr').value=prefs.arr;$('#battle-mute').checked=prefs.muted;
    if(room)send({type:'settings',skin:prefs.skin,das:prefs.das,arr:prefs.arr});
    const mine=latest?.players.find(p=>p.id===selfId),other=latest?.players.find(p=>p.id!==selfId);
    renderBoard($('#self-board'),mine,true);renderMiniatures(latest?.roster||[]);renderPreviews(mine);
  });
  setInterval(()=>{if(connected()){if(performance.now()-lastPong>15000){connection(false,'연결 지연 · 확인 중');socket.close();}else send({type:'ping',at:performance.now()});}},5000);
  TTRSAccount.ready.then(user=>{$('#nickname').value=user.nickname;connect();}).catch(e=>notify(e.message));
})();
