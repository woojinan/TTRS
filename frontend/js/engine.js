/* Pure rules shared by the browser and Node regression tests. */
(function(root) {
  "use strict";
  const W=10,H=22;
  const PIECES={I:{c:"#35c9d6",m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},O:{c:"#f2d247",m:[[1,1],[1,1]]},T:{c:"#a66be0",m:[[0,1,0],[1,1,1],[0,0,0]]},S:{c:"#52bd72",m:[[0,1,1],[1,1,0],[0,0,0]]},Z:{c:"#e75656",m:[[1,1,0],[0,1,1],[0,0,0]]},J:{c:"#518ce2",m:[[1,0,0],[1,1,1],[0,0,0]]},L:{c:"#e99549",m:[[0,0,1],[1,1,1],[0,0,0]]}};
  const JL={"0>1":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],"1>0":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],"1>2":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],"2>1":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],"2>3":[[0,0],[1,0],[1,-1],[0,2],[1,2]],"3>2":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],"3>0":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],"0>3":[[0,0],[1,0],[1,-1],[0,2],[1,2]]};
  const IK={"0>1":[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],"1>0":[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],"1>2":[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],"2>1":[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],"2>3":[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],"3>2":[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],"3>0":[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],"0>3":[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]};
  function bag(random=Math.random) {
    const result=Object.keys(PIECES);
    for(let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  }
  // Dedicated half-turn kicks, following osk's published TETR.IO 180 diagram.
  // https://tetris.wiki/images/5/52/TETR.IO_180kicks.png (positive Y is DOWN here).
  // Quarter turns retain their existing SRS tables; this is not full SRS+.
  const HALF={
    "0>2":[[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]],
    "2>0":[[0,0],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
    "1>3":[[0,0],[1,0],[1,-2],[1,-1],[0,-2],[0,-1]],
    "3>1":[[0,0],[-1,0],[-1,-2],[-1,-1],[0,-2],[0,-1]]
  };
  function clone(type) { const p=PIECES[type]; return {type,c:p.c,m:p.m.map(r=>[...r]),x:Math.floor((W-p.m[0].length)/2),y:0,r:0}; }
  function cells(piece) { const result=[]; piece.m.forEach((row,y)=>row.forEach((v,x)=>{if(v)result.push({x:piece.x+x,y:piece.y+y});})); return result; }
  function scoreClear(n,spin,perfect,combo,b2b) {
    const difficult=n>0&&(n===4||Boolean(spin)),chained=difficult&&b2b;
    let points=(spin==="T-SPIN MINI"?[100,200,400][n]:spin?[400,800,1200,1600][n]:[0,100,300,500,800][n])||0;
    if(chained)points*=1.5;
    const nextCombo=n?combo+1:-1;
    points+=Math.max(0,nextCombo)*50;
    if(perfect)points+=(n===4&&chained?3200:[0,800,1200,1800,2000][n])||0;
    return {points,combo:nextCombo,b2b:n?difficult:b2b,chained};
  }
  class Game {
    constructor(random=Math.random) {
      this.random=random; this.board=Array.from({length:H},()=>Array(W).fill(null)); this.queue=[];
      this.hold=null; this.canHold=true; this.score=0; this.lines=0; this.pieces=0; this.combo=-1;
      this.maxCombo=0; this.b2b=false; this.tspins=0; this.tetrises=0; this.perfects=0; this.over=false; this.spawn(0);
    }
    refill() { while(this.queue.length<6)this.queue.push(...bag(this.random)); }
    blocked(piece=this.current,dx=0,dy=0,matrix=piece.m) {
      return matrix.some((row,y)=>row.some((v,x)=>v&&(piece.x+x+dx<0||piece.x+x+dx>=W||piece.y+y+dy>=H||(piece.y+y+dy>=0&&this.board[piece.y+y+dy][piece.x+x+dx]))));
    }
    grounded() { return this.blocked(this.current,0,1); }
    resetPiece(now) { this.lastRotate=false; this.lastKick=0; this.lastTurn=0; this.groundedAt=null; this.lockResets=0; this.gravityAt=now; this.over=this.blocked(); }
    spawn(now) { this.refill(); this.current=clone(this.queue.shift()); this.refill(); this.canHold=true; this.resetPiece(now); }
    resetLock(now,wasGrounded) {
      if(wasGrounded&&this.lockResets<15) { this.lockResets++; this.groundedAt=now; }
      if(this.grounded()&&this.groundedAt===null)this.groundedAt=now;
    }
    move(dx,now) {
      if(this.over||this.blocked(this.current,dx))return false;
      const wasGrounded=this.grounded(); this.current.x+=dx; this.lastRotate=false; this.resetLock(now,wasGrounded); return true;
    }
    rotate(dir,now) {
      if(this.over||this.current.type==="O"||![-1,1,2].includes(dir))return false;
      const p=this.current,m=dir===2?p.m.map(row=>[...row].reverse()).reverse():dir===-1?p.m[0].map((_,i)=>p.m.map(row=>row[row.length-1-i])):p.m[0].map((_,i)=>p.m.map(row=>row[i]).reverse());
      const target=(p.r+(dir===-1?3:dir))%4,tests=(dir===2?HALF:p.type==="I"?IK:JL)[`${p.r}>${target}`];
      for(let i=0;i<tests.length;i++) {
        const [dx,dy]=tests[i];
        if(!this.blocked(p,dx,dy,m)) {
          const wasGrounded=this.grounded(); Object.assign(p,{x:p.x+dx,y:p.y+dy,m,r:target});
          this.lastRotate=true; this.lastKick=i; this.lastTurn=dir; this.resetLock(now,wasGrounded); return true;
        }
      }
      return false;
    }
    down(now,manual=false) {
      if(this.over||this.blocked(this.current,0,1))return false;
      this.current.y++; this.lastRotate=false; this.gravityAt=now;
      if(manual)this.score++;
      if(this.groundedAt===null&&this.grounded())this.groundedAt=now;
      return true;
    }
    holdPiece(now) {
      if(this.over||!this.canHold)return false;
      const old=this.hold; this.hold=this.current.type;
      if(old) { this.current=clone(old); this.resetPiece(now); } else this.spawn(now);
      this.canHold=false; return true;
    }
    spin() {
      if(this.current.type!=="T"||!this.lastRotate)return "";
      const px=this.current.x+1,py=this.current.y+1;
      const occupied=([x,y])=>x<0||x>=W||y>=H||(y>=0&&Boolean(this.board[y][x]));
      const corners=[[px-1,py-1],[px+1,py-1],[px-1,py+1],[px+1,py+1]];
      if(corners.filter(occupied).length<3)return "";
      const front=[[0,1],[1,3],[2,3],[0,2]][this.current.r];
      // The SRS fifth-test upgrade only belongs to a quarter turn, not a 180 kick.
      return front.every(i=>occupied(corners[i]))||(Math.abs(this.lastTurn)===1&&this.lastKick===4)?"T-SPIN":"T-SPIN MINI";
    }
    hardDrop(now) {
      if(this.over)return null;
      const from=cells(this.current); let distance=0;
      while(!this.blocked(this.current,0,1)) { this.current.y++; distance++; }
      if(distance)this.lastRotate=false;
      this.score+=distance*2; return {...this.lock(now),from,distance};
    }
    lock(now) {
      if(this.over)return null;
      const placed=cells(this.current),color=this.current.c,spin=this.spin();
      placed.forEach(({x,y})=>{if(y>=0)this.board[y][x]=color;}); this.pieces++;
      const rows=[]; this.board.forEach((row,y)=>{if(row.every(Boolean))rows.push(y);});
      this.board=this.board.filter(row=>!row.every(Boolean)); while(this.board.length<H)this.board.unshift(Array(W).fill(null));
      const perfect=rows.length>0&&this.board.every(row=>row.every(v=>!v));
      const scoring=scoreClear(rows.length,spin,perfect,this.combo,this.b2b);
      this.score+=scoring.points; this.combo=scoring.combo; this.b2b=scoring.b2b;
      this.lines+=rows.length; this.maxCombo=Math.max(this.maxCombo,this.combo);
      if(spin)this.tspins++; if(rows.length===4)this.tetrises++; if(perfect)this.perfects++;
      const lockOut=placed.every(({y})=>y+rows.filter(row=>row>y).length<2);
      this.spawn(now); this.over=this.over||lockOut;
      return {rows,placed,color,spin,perfect,...scoring};
    }
    update(now) {
      if(this.over)return null;
      const steps=Math.min(22,Math.floor((now-this.gravityAt)/1000));
      for(let i=0;i<steps&&!this.grounded();i++)this.down(this.gravityAt+1000);
      if(this.grounded()) {
        if(this.groundedAt===null)this.groundedAt=now;
        if(now-this.groundedAt>=500)return this.lock(now);
      }
      return null;
    }
    // Called between pieces. Garbage never interrupts a falling piece.
    addGarbage(holes,now) {
      if(this.over||!holes.length)return;
      for(const hole of holes) {
        if(this.board.shift().some(Boolean))this.over=true;
        this.board.push(Array.from({length:W},(_,x)=>x===hole?null:"#647580"));
      }
      this.over=this.over||this.blocked();
      this.gravityAt=now;this.groundedAt=null;
    }
  }
  function seededRandom(seed) {
    return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
  }
  function attackLines(event) {
    const n=event.rows.length;if(!n)return 0;
    const base=event.spin==="T-SPIN MINI"?([0,0,1][n]||0):event.spin?([0,2,4,6][n]||0):([0,0,1,2,4][n]||0);
    return base+(event.chained?1:0)+Math.min(4,Math.floor((Math.max(0,event.combo)+1)/2))+(event.perfect?10:0);
  }
  const api={Game,PIECES,W,H,bag,clone,cells,scoreClear,seededRandom,attackLines};
  if(typeof module!=="undefined"&&module.exports)module.exports=api; else root.Tetris=api;
})(globalThis);
