/* Authoritative 2–50 player arena; identity arrives only from the Python bridge. */
'use strict';
const {randomBytes}=require('node:crypto');
const {Game,seededRandom,attackLines,cells,PIECES}=require('../frontend/js/engine.js');
const ACTIONS=new Set(['left','right','down','rotate-left','rotate-right','rotate-180','hold','drop']);
const HELD=new Set(['left','right','down']),skins=new Set(['jelly','mochi','crystal','neon','retro']);
const palette=Object.fromEntries(Object.entries(PIECES).map(([type,p])=>[p.c,type]));
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,n):'';
const limit=(v,lo,hi,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback;
class BattleServer {
  constructor(send,clock=()=>performance.now(),onResult=()=>{}) {this.send=send;this.clock=clock;this.onResult=onResult;this.peers=new Map();this.rooms=new Map();}
  connect(id,identity={}) {
    if(this.peers.size>=256){this.send(id,{type:'expired'});return;}
    if(identity.userId&&[...this.peers.values()].some(p=>p.userId===identity.userId)){this.send(id,{type:'error',message:'이미 다른 탭에서 온라인에 접속 중입니다. 이전 대결 탭을 닫아 주세요.'});this.send(id,{type:'duplicate'});return;}
    this.peers.set(id,{id,userId:identity.userId||id,name:identity.name||'게스트'+id,room:null,ready:false,skin:'jelly',das:133,arr:10,lastSeen:this.clock(),rateAt:this.clock(),rate:0});
    this.send(id,{type:'hello',id,name:this.peers.get(id).name});this.list(id);
  }
  error(id,message){this.send(id,{type:'error',message});}
  list(id){this.send(id,{type:'rooms',rooms:[...this.rooms.values()].map(r=>({code:r.code,title:r.title,count:r.players.length,capacity:50,phase:r.phase}))});}
  lists(){for(const p of this.peers.values())if(!p.room)this.list(p.id);}
  tell(room,message){for(const id of room.players)this.send(id,message);}
  active(room){return ['countdown','playing'].includes(room.phase);}
  alive(room){return [...(room.members?.values()||[])].filter(p=>!p.eliminated);}
  roomInfo(room){return {type:'room',code:room.code,title:room.title,phase:room.phase,match:room.match,result:room.result,host:room.players[0],capacity:50,players:room.players.map(id=>{const p=this.peers.get(id);return {id,name:p.name,ready:p.ready,skin:p.skin,eliminated:Boolean(p.eliminated),placement:p.placement};})};}
  announce(room){this.tell(room,this.roomInfo(room));this.lists();}
  configure(p,m){p.skin=skins.has(m.skin)?m.skin:p.skin;p.das=limit(m.das,0,300,p.das);p.arr=limit(m.arr,0,100,p.arr);}
  receive(id,m){
    const p=this.peers.get(id);if(!p||!m||typeof m!=='object'||Array.isArray(m))return;
    const now=this.clock();p.lastSeen=now;if(now-p.rateAt>=1000){p.rateAt=now;p.rate=0;}if(++p.rate>180){if(p.rate===181)this.error(id,'입력이 너무 빠릅니다.');return;}
    if(m.type==='ping'){this.send(id,{type:'pong',at:m.at});return;}
    if(m.type==='list'){this.list(id);return;}
    if(m.type==='leave'){this.leave(id);this.send(id,{type:'left'});this.list(id);return;}
    if(m.type==='create'||m.type==='join'){
      if(p.room){this.error(id,'현재 방에서 먼저 나가 주세요.');return;}
      let room;
      if(m.type==='create'){
        if(this.rooms.size>=64){this.error(id,'방이 가득 찼습니다.');return;}
        let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));
        room={code,title:clean(m.title,32)||`${p.name}s_room`,players:[],phase:'waiting',match:null,result:null,chat:[],beginAt:now,members:new Map()};this.rooms.set(code,room);
      }else{
        room=this.rooms.get(clean(m.code,6).toUpperCase());if(!room){this.error(id,'존재하지 않는 방 코드입니다.');return;}
        if(room.players.length>=50){this.error(id,'방 정원 50명이 모두 찼습니다.');return;}
        if(this.active(room)){this.error(id,'대결이 진행 중입니다. 다음 라운드에 참가해 주세요.');return;}
      }
      this.configure(p,m);p.room=room.code;p.ready=false;p.game=null;p.eliminated=false;p.placement=null;room.players.push(id);
      if(room.phase==='finished'){room.phase='waiting';room.match=null;room.result=null;room.beginAt=now;room.members=new Map();for(const pid of room.players)Object.assign(this.peers.get(pid),{ready:false,game:null,eliminated:false,placement:null});}
      this.send(id,{type:'joined',code:room.code,chat:room.chat});this.announce(room);this.snapshot(room,now);return;
    }
    const room=this.rooms.get(p.room);if(!room)return;
    if(m.type==='settings'){this.configure(p,m);this.announce(room);return;}
    if(m.type==='chat'){
      const text=clean(m.text,200);if(!text)return;if(p.chatAt!==undefined&&now-p.chatAt<500){this.error(id,'메시지는 잠깐 간격을 두고 보내 주세요.');return;}p.chatAt=now;
      const entry={type:'chat',id,name:p.name,text,time:Date.now()};room.chat.push(entry);room.chat=room.chat.slice(-100);this.tell(room,entry);return;
    }
    if(m.type==='ready'&&!this.active(room)){if(room.players[0]===id)return;p.ready=m.ready===true;this.configure(p,m);this.announce(room);return;}
    if(m.type==='start'&&!this.active(room)){
      if(room.players[0]!==id){this.error(id,'방장만 시작할 수 있습니다.');return;}
      if(room.players.length<2||!room.players.some(pid=>pid!==id&&this.peers.get(pid).ready)){this.error(id,'다른 참가자 한 명 이상이 준비해야 합니다.');return;}
      this.start(room,now);this.announce(room);return;
    }
    if(m.type==='forfeit'&&this.active(room)){this.eliminate(room,[p],'forfeit',now);return;}
    if(m.type!=='input'||room.phase!=='playing'||p.eliminated||m.match!==room.match||!Number.isSafeInteger(m.seq)||m.seq<=p.seq)return;
    p.seq=m.seq;if(m.action==='release'){this.resetInput(p);return;}if(!ACTIONS.has(m.action)||!['down','up','tap'].includes(m.edge))return;
    if(m.edge==='up'){delete p.held[m.action];if(m.action===p.direction){p.direction=p.held.left?'left':p.held.right?'right':null;p.repeatAt=now+p.das;}return;}
    if(m.edge==='down'&&p.held[m.action])return;if(m.action==='drop'&&now-p.lastDrop<40)return;
    if(m.edge==='down')p.held[m.action]=true;
    if(m.edge==='down'&&HELD.has(m.action)){if(m.action==='down')p.softAt=now+35;else{p.direction=m.action;p.repeatAt=now+p.das;}}
    this.act(room,p,m.action,now);this.checkOver(room,now);
  }
  resetInput(p){p.held={};p.direction=null;p.repeatAt=0;p.softAt=0;}
  start(room,now){
    const seed=randomBytes(4).readUInt32LE();Object.assign(room,{match:randomBytes(16).toString('hex'),phase:'countdown',beginAt:now+3000,result:null,garbageRandom:seededRandom(seed^0x5a17),lastState:0,members:new Map()});
    room.players.forEach(id=>{const p=this.peers.get(id);Object.assign(p,{game:new Game(seededRandom(seed)),pending:[],sent:0,received:0,cancelled:0,seq:-1,lastDrop:-Infinity,event:null,ready:false,eliminated:false,placement:null,target:null,outAt:null});this.resetInput(p);room.members.set(id,p);});this.snapshot(room,now);
  }
  target(room,p){const candidates=this.alive(room).filter(o=>o.id!==p.id);return candidates[Math.floor(room.garbageRandom()*candidates.length)];}
  act(room,p,action,now){const g=p.game;let event=null,changed=false;
    if(action==='left'||action==='right')changed=g.move(action==='left'?-1:1,now);else if(action==='down')changed=g.down(now,true);else if(action.startsWith('rotate'))changed=g.rotate(action==='rotate-left'?-1:action==='rotate-180'?2:1,now);else if(action==='hold')changed=g.holdPiece(now);else if(action==='drop'){p.lastDrop=now;event=g.hardDrop(now);}
    if(event)this.lock(room,p,event,now);else if(changed)p.event={id:(p.event?.id||0)+1,action};
  }
  lock(room,p,event,now){let outgoing=attackLines(event),cancelled=0;
    while(outgoing&&p.pending.length){p.pending.shift();outgoing--;cancelled++;}p.cancelled+=cancelled;
    const opponent=outgoing?this.target(room,p):null;if(opponent){const hole=Math.floor(room.garbageRandom()*10),accepted=Math.min(outgoing,100-opponent.pending.length);for(let i=0;i<accepted;i++)opponent.pending.push({hole,due:now+1200});p.sent+=accepted;outgoing=accepted;p.target=opponent.id;}
    let risen=0;if(!event.rows.length){const holes=[];while(holes.length<8&&p.pending[0]?.due<=now)holes.push(p.pending.shift().hole);p.game.addGarbage(holes,now);risen=holes.length;p.received+=risen;}
    p.event={id:(p.event?.id||0)+1,action:'lock',lines:event.rows.length,spin:event.spin,perfect:event.perfect,chained:event.chained,combo:event.combo,outgoing,cancelled,risen};
  }
  checkOver(room,now){if(room.phase!=='playing')return;const dead=this.alive(room).filter(p=>p.game.over);if(dead.length)this.eliminate(room,dead,'topout',now);}
  eliminate(room,players,reason,now){if(!this.active(room))return;const dead=players.filter(p=>!p.eliminated&&room.members.has(p.id));if(!dead.length)return;
    const placement=this.alive(room).length-dead.length+1;
    for(const p of dead){p.eliminated=true;p.placement=placement;p.outAt=now;p.reason=reason;p.game.over=true;this.resetInput(p);}
    const alive=this.alive(room);
    if(alive.length<=1)this.finish(room,alive[0]?.id||null,reason,now);else{this.snapshot(room,now);this.announce(room);}
  }
  finish(room,winner,reason,now){if(!this.active(room))return;
    if(winner){const p=room.members.get(winner);p.placement=1;p.outAt=now;}
    const standings=[...room.members.values()].map(p=>({id:p.id,name:p.name,won:p.id===winner,placement:p.placement||1,score:p.game.score,lines:p.game.lines,pieces:p.game.pieces,sent:p.sent,elapsed:Math.max(0,(p.outAt??now)-room.beginAt)})).sort((a,b)=>a.placement-b.placement);
    room.phase='finished';room.result={winner,reason,elapsed:Math.max(0,now-room.beginAt),standings,names:Object.fromEntries(standings.map(p=>[p.id,p.name]))};
    for(const p of room.members.values()){p.ready=false;this.resetInput(p);}
    this.onResult({match:room.match,elapsed:room.result.elapsed,players:standings.map(s=>({...s,userId:room.members.get(s.id).userId}))});
    this.snapshot(room,now);this.announce(room);
  }
  leave(id,reason='leave'){const p=this.peers.get(id);if(!p)return;const room=this.rooms.get(p.room);if(!room)return;
    if(this.active(room))this.eliminate(room,[p],reason,this.clock());
    // A departed peer can enter another room; freeze this match's retained state.
    if(room.members.has(id))room.members.set(id,{...p,game:JSON.parse(JSON.stringify(p.game)),pending:[...(p.pending||[])]});
    p.room=null;p.ready=false;room.players=room.players.filter(pid=>pid!==id);
    if(!this.active(room))for(const pid of room.players)this.peers.get(pid).ready=false;
    if(!room.players.length)this.rooms.delete(room.code);else this.announce(room);this.lists();
  }
  disconnect(id){this.leave(id,'disconnect');this.peers.delete(id);}
  snapshot(room,now){
    const members=room.match?[...room.members.values()]:room.players.map(id=>this.peers.get(id));
    const common={type:'state',match:room.match,phase:room.phase,countdown:Math.max(0,room.beginAt-now),elapsed:room.result?.elapsed??Math.max(0,now-room.beginAt),result:room.result,alive:room.match?this.alive(room).length:room.players.length,total:members.length};
    // Own full state + all 49 miniatures. One character per cell keeps traffic bounded.
    const summary=p=>({id:p.id,name:p.name,skin:p.skin,eliminated:Boolean(p.eliminated),placement:p.placement,lines:p.game?.lines||0,sent:p.sent||0});
    const full=p=>p?.game?{...summary(p),board:p.game.board,current:p.game.current,hold:p.game.hold,canHold:p.game.canHold,queue:p.game.queue.slice(0,5),over:p.game.over,score:p.game.score,pieces:p.game.pieces,received:p.received,pending:p.pending.length,mature:p.pending.filter(v=>v.due<=now).length,event:p.event,target:p.target}:p?summary(p):null;
    const compact=p=>{const board=p.game?.board.slice(2).map(row=>row.map(v=>v?(palette[v]||'G'):'.'))||Array.from({length:20},()=>Array(10).fill('.'));if(p.game?.current&&!p.game.over)for(const {x,y} of cells(p.game.current))if(y>=2&&y<22&&x>=0&&x<10)board[y-2][x]=p.game.current.type;return {...summary(p),ready:p.ready,mini:board.map(row=>row.join('')).join('')};};
    const roster=members.map(compact);
    for(const id of room.players){const p=this.peers.get(id);this.send(id,{...common,players:[full(p)],roster});}
  }
  tick(){const now=this.clock();for(const p of this.peers.values())if(now-p.lastSeen>20000){this.send(p.id,{type:'expired'});this.disconnect(p.id);}
    for(const room of this.rooms.values()){
      if(room.phase==='countdown'&&now>=room.beginAt){room.phase='playing';for(const p of this.alive(room))p.game.gravityAt=now;this.announce(room);}
      if(room.phase==='playing'){
        for(const p of this.alive(room)){
          if(p.direction&&now>=p.repeatAt){if(p.arr===0){for(let i=0;i<10;i++)p.game.move(p.direction==='left'?-1:1,now);p.repeatAt=now+16;}else{let n=0;while(now>=p.repeatAt&&n++<10){p.game.move(p.direction==='left'?-1:1,now);p.repeatAt+=p.arr;}if(now>=p.repeatAt)p.repeatAt=now+p.arr;}}
          if(p.held.down&&now>=p.softAt){let n=0;while(now>=p.softAt&&n++<22){p.game.down(now,true);p.softAt+=35;}if(now>=p.softAt)p.softAt=now+35;}
          const event=p.game.update(now);if(event)this.lock(room,p,event,now);
        }this.checkOver(room,now);
      }
      if(this.active(room)&&now-room.lastState>=100){room.lastState=now;this.snapshot(room,now);}
    }
  }
}
module.exports={BattleServer};
if(require.main===module){const output=o=>process.stdout.write(JSON.stringify(o)+'\n');const server=new BattleServer((client,message)=>output({client,message}),undefined,r=>output({kind:'records',...r}));
  require('node:readline').createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{try{const e=JSON.parse(line);if(e.op==='connect')server.connect(e.id,e.message);else if(e.op==='disconnect')server.disconnect(e.id);else if(e.op==='message')server.receive(e.id,e.message);}catch(e){console.error(e.stack);}}).on('close',()=>process.exit(0));setInterval(()=>server.tick(),1000/60);
}
