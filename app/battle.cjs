/* Authoritative room simulation. The exact same rules run in solo and online. */
"use strict";
const {randomBytes}=require('node:crypto');
const {Game,seededRandom,attackLines}=require('../frontend/js/engine.js');
const ACTIONS=new Set(['left','right','down','rotate-left','rotate-right','rotate-180','hold','drop']);
const HELD=new Set(['left','right','down']);
const skins=new Set(['jelly','mochi','crystal','neon','retro']);
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,n):'';
const limit=(v,lo,hi,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback;

class BattleServer {
  constructor(send,clock=()=>performance.now()) {this.send=send;this.clock=clock;this.peers=new Map();this.rooms=new Map();this.lastPublish=0;}
  connect(id) {
    if(this.peers.size>=256){this.send(id,{type:'error',message:'서버가 혼잡합니다. 잠시 후 다시 접속하세요.'});return;}
    this.peers.set(id,{id,name:'플레이어',room:null,ready:false,skin:'jelly',das:133,arr:10,lastSeen:this.clock(),rateAt:this.clock(),rate:0});
    this.send(id,{type:'hello',id});this.list(id);
  }
  error(id,message){this.send(id,{type:'error',message});}
  list(id){this.send(id,{type:'rooms',rooms:[...this.rooms.values()].map(r=>({code:r.code,title:r.title,count:r.players.length,phase:r.phase}))});}
  lists(){for(const p of this.peers.values())if(!p.room)this.list(p.id);}
  tell(room,message){for(const id of room.players)this.send(id,message);}
  roomInfo(room){return {type:'room',code:room.code,title:room.title,phase:room.phase,match:room.match,result:room.result,players:room.players.map(id=>{const p=this.peers.get(id);return {id,name:p.name,ready:p.ready,skin:p.skin};})};}
  announce(room){this.tell(room,this.roomInfo(room));this.lists();}
  configure(p,m){p.skin=skins.has(m.skin)?m.skin:p.skin;p.das=limit(m.das,0,300,p.das);p.arr=limit(m.arr,0,100,p.arr);}
  receive(id,m) {
    const p=this.peers.get(id);if(!p||!m||typeof m!=='object'||Array.isArray(m))return;
    const now=this.clock();p.lastSeen=now;
    if(now-p.rateAt>=1000){p.rateAt=now;p.rate=0;}
    if(++p.rate>180){if(p.rate===181)this.error(id,'입력이 너무 빠릅니다. 잠시 기다려 주세요.');return;}
    if(m.type==='ping'){this.send(id,{type:'pong',at:m.at});return;}
    if(m.type==='list'){this.list(id);return;}
    if(m.type==='leave'){this.leave(id);this.send(id,{type:'left'});this.list(id);return;}
    if(m.type==='create'||m.type==='join') {
      if(p.room){this.error(id,'현재 방에서 먼저 나가 주세요.');return;}
      let room;
      if(m.type==='create') {
        if(this.rooms.size>=64){this.error(id,'방이 가득 찼습니다. 잠시 후 다시 시도하세요.');return;}
        let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));
        room={code,title:clean(m.title,32)||'함께 한 판!',players:[],phase:'waiting',match:null,result:null,chat:[],beginAt:now};this.rooms.set(code,room);
      } else {
        room=this.rooms.get(clean(m.code,6).toUpperCase());
        if(!room){this.error(id,'존재하지 않는 방 코드입니다.');return;}
        if(room.players.length>=2){this.error(id,'이미 두 명이 참가한 방입니다.');return;}
        if(['playing','countdown'].includes(room.phase)){this.error(id,'대결이 진행 중입니다.');return;}
      }
      p.name=clean(m.name,16)||'플레이어';this.configure(p,m);p.room=room.code;p.ready=false;p.game=null;room.players.push(id);
      if(room.phase==='finished'){
        room.phase='waiting';room.match=null;room.result=null;room.beginAt=now;
        for(const pid of room.players){const player=this.peers.get(pid);player.ready=false;player.game=null;}
      }
      this.send(id,{type:'joined',code:room.code,chat:room.chat});this.announce(room);this.snapshot(room,now);return;
    }
    const room=this.rooms.get(p.room);if(!room)return;
    if(m.type==='settings'){this.configure(p,m);this.announce(room);return;}
    if(m.type==='chat') {
      const value=clean(m.text,200);if(!value)return;
      if(p.chatAt!==undefined&&now-p.chatAt<400){this.error(id,'메시지는 잠깐 간격을 두고 보내 주세요.');return;}
      p.chatAt=now;const entry={type:'chat',id,name:p.name,text:value,time:Date.now()};room.chat.push(entry);room.chat=room.chat.slice(-60);this.tell(room,entry);return;
    }
    if(m.type==='ready'&&['waiting','finished'].includes(room.phase)) {
      p.ready=m.ready===true;this.configure(p,m);
      if(room.players.length===2&&room.players.every(pid=>this.peers.get(pid).ready))this.start(room,now);
      this.announce(room);return;
    }
    if(m.type==='forfeit'&&['playing','countdown'].includes(room.phase)){this.finish(room,id,'forfeit',now);return;}
    if(m.type!=='input'||room.phase!=='playing'||m.match!==room.match||!Number.isSafeInteger(m.seq)||m.seq<=p.seq)return;
    p.seq=m.seq;
    if(m.action==='release'){this.resetInput(p);return;}
    if(!ACTIONS.has(m.action)||!['down','up','tap'].includes(m.edge))return;
    if(m.edge==='up'){
      delete p.held[m.action];
      if(m.action===p.direction){p.direction=p.held.left?'left':p.held.right?'right':null;p.repeatAt=now+p.das;}return;
    }
    if(m.edge==='down'&&p.held[m.action])return;
    if(m.action==='drop'&&now-p.lastDrop<40)return;
    if(m.edge==='down')p.held[m.action]=true;
    if(m.edge==='down'&&HELD.has(m.action)){
      if(m.action==='down')p.softAt=now+35;else{p.direction=m.action;p.repeatAt=now+p.das;}
    }
    this.act(room,p,m.action,now);this.checkOver(room,now);
  }
  resetInput(p){p.held={};p.direction=null;p.repeatAt=0;p.softAt=0;}
  start(room,now) {
    const seed=randomBytes(4).readUInt32LE();room.match=randomBytes(8).toString('hex');room.phase='countdown';room.beginAt=now+3000;room.result=null;
    room.garbageRandom=seededRandom(seed^0x5a17);room.lastState=0;
    for(const id of room.players){const p=this.peers.get(id);Object.assign(p,{game:new Game(seededRandom(seed)),pending:[],sent:0,received:0,cancelled:0,seq:-1,lastDrop:-Infinity,event:null,ready:false});this.resetInput(p);}
    this.snapshot(room,now);
  }
  act(room,p,action,now){
    const g=p.game;let event=null,changed=false;
    if(action==='left'||action==='right')changed=g.move(action==='left'?-1:1,now);
    else if(action==='down')changed=g.down(now,true);
    else if(action.startsWith('rotate'))changed=g.rotate(action==='rotate-left'?-1:action==='rotate-180'?2:1,now);
    else if(action==='hold')changed=g.holdPiece(now);
    else if(action==='drop'){p.lastDrop=now;event=g.hardDrop(now);}
    if(event)this.lock(room,p,event,now);else if(changed)p.event={id:(p.event?.id||0)+1,action};
  }
  lock(room,p,event,now){
    let outgoing=attackLines(event),cancelled=0;
    // FIFO cancellation includes both warning-time and ready-to-rise garbage.
    while(outgoing&&p.pending.length){p.pending.shift();outgoing--;cancelled++;}
    p.cancelled+=cancelled;
    const opponent=this.peers.get(room.players.find(id=>id!==p.id));
    if(outgoing&&opponent){
      const hole=Math.floor(room.garbageRandom()*10);
      for(let i=0;i<outgoing;i++)opponent.pending.push({hole,due:now+1200});
      p.sent+=outgoing;
    }
    let risen=0;
    if(!event.rows.length){
      const holes=[];while(holes.length<8&&p.pending[0]?.due<=now)holes.push(p.pending.shift().hole);
      p.game.addGarbage(holes,now);risen=holes.length;p.received+=risen;
    }
    p.event={id:(p.event?.id||0)+1,action:'lock',lines:event.rows.length,spin:event.spin,perfect:event.perfect,chained:event.chained,combo:event.combo,outgoing,cancelled,risen};
  }
  checkOver(room,now){
    if(room.phase!=='playing')return;
    const dead=room.players.filter(id=>this.peers.get(id).game.over);
    if(dead.length)this.finish(room,dead.length===2?null:dead[0],'topout',now);
  }
  finish(room,loser,reason,now){
    if(!['playing','countdown'].includes(room.phase))return;
    const winner=loser?room.players.find(id=>id!==loser):null;
    room.phase='finished';room.result={winner:winner||null,reason,elapsed:Math.max(0,now-room.beginAt),names:Object.fromEntries(room.players.map(id=>[id,this.peers.get(id).name]))};
    for(const id of room.players){const p=this.peers.get(id);p.ready=false;this.resetInput(p);}
    this.snapshot(room,now);this.announce(room);
  }
  leave(id,reason='leave'){
    const p=this.peers.get(id);if(!p)return;const room=this.rooms.get(p.room);p.room=null;p.ready=false;
    if(!room)return;
    if(['countdown','playing'].includes(room.phase))this.finish(room,id,reason,this.clock());
    room.players=room.players.filter(pid=>pid!==id);
    for(const pid of room.players)this.peers.get(pid).ready=false;
    if(!room.players.length)this.rooms.delete(room.code);else this.announce(room);
    this.lists();
  }
  disconnect(id){this.leave(id,'disconnect');this.peers.delete(id);}
  snapshot(room,now){
    const players=room.players.map(id=>{const p=this.peers.get(id),g=p.game;
      if(!g)return {id,name:p.name,skin:p.skin};
      return {id,name:p.name,skin:p.skin,board:g.board,current:g.current,hold:g.hold,canHold:g.canHold,queue:g.queue.slice(0,5),over:g.over,score:g.score,lines:g.lines,pieces:g.pieces,combo:g.combo,b2b:g.b2b,sent:p.sent,received:p.received,cancelled:p.cancelled,pending:p.pending.length,mature:p.pending.filter(v=>v.due<=now).length,event:p.event};});
    this.tell(room,{type:'state',match:room.match,phase:room.phase,countdown:Math.max(0,room.beginAt-now),elapsed:room.result?.elapsed??Math.max(0,now-room.beginAt),result:room.result,players});
  }
  tick(){
    const now=this.clock();
    for(const p of this.peers.values())if(now-p.lastSeen>20000){this.send(p.id,{type:'expired'});this.disconnect(p.id);}
    for(const room of this.rooms.values()){
      if(room.phase==='countdown'&&now>=room.beginAt){room.phase='playing';for(const id of room.players)this.peers.get(id).game.gravityAt=now;this.announce(room);}
      if(room.phase==='playing'){
        for(const id of room.players){const p=this.peers.get(id);
          if(p.direction&&now>=p.repeatAt){
            if(p.arr===0){for(let i=0;i<10;i++)p.game.move(p.direction==='left'?-1:1,now);p.repeatAt=now+16;}
            else{let n=0;while(now>=p.repeatAt&&n++<10){p.game.move(p.direction==='left'?-1:1,now);p.repeatAt+=p.arr;}if(now>=p.repeatAt)p.repeatAt=now+p.arr;}
          }
          if(p.held.down&&now>=p.softAt){let n=0;while(now>=p.softAt&&n++<22){p.game.down(now,true);p.softAt+=35;}if(now>=p.softAt)p.softAt=now+35;}
          const event=p.game.update(now);if(event)this.lock(room,p,event,now);
        }
        this.checkOver(room,now);
      }
      if(['playing','countdown'].includes(room.phase)&&now-room.lastState>=45){room.lastState=now;this.snapshot(room,now);}
    }
  }
}
module.exports={BattleServer};
if(require.main===module){
  const server=new BattleServer((client,message)=>process.stdout.write(JSON.stringify({client,message})+'\n'));
  require('node:readline').createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{
    try{const e=JSON.parse(line);if(e.op==='connect')server.connect(e.id);else if(e.op==='disconnect')server.disconnect(e.id);else if(e.op==='message')server.receive(e.id,e.message);}catch(e){console.error(e.stack);}
  }).on('close',()=>process.exit(0));
  setInterval(()=>server.tick(),1000/60);
}
