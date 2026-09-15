'use strict';
const {Game,seededRandom}=require('../frontend/js/engine.js');
function verify(m){
  if(!Array.isArray(m.actions)||m.actions.length>60000||!['sprint','attack'].includes(m.mode)||!Number.isFinite(m.elapsed)||m.elapsed<0||m.elapsed>3600000)throw Error('bounds');
  const g=new Game(seededRandom(m.seed));let previous=0,lastUpdate=0,doneAt=null;
  const methods={move:1,rotate:1,down:0,holdPiece:0,hardDrop:0,update:0};
  for(const a of m.actions){
    if(!Array.isArray(a)||a.length!==3||!Object.hasOwn(methods,a[0])||!Number.isFinite(a[1])||a[1]<previous||a[1]>m.elapsed+.01||!Array.isArray(a[2]))throw Error('action');
    const [method,t,args]=a;
    if(t-previous>2000||t-lastUpdate>2000)throw Error('gap');previous=t;if(method==='update')lastUpdate=t;
    if(doneAt!==null||g.over||m.mode==='attack'&&t>=120000)throw Error('after finish');
    if(method==='move'&&(args.length!==1||![-1,1].includes(args[0])))throw Error('move');
    if(method==='rotate'&&(args.length!==1||![-1,1,2].includes(args[0])))throw Error('rotate');
    if(method==='down'&&(args.length!==1||typeof args[0]!=='boolean'))throw Error('down');
    if(['holdPiece','hardDrop','update'].includes(method)&&args.length)throw Error('args');
    if(method==='move'||method==='rotate')g[method](args[0],t);
    else if(method==='down')g.down(t,args[0]);else g[method](t);
    if(g.over||m.mode==='sprint'&&g.lines>=40)doneAt=t;
  }
  if(m.elapsed-previous>2000)throw Error('missing frames');
  const completed=m.mode==='sprint'?g.lines>=40:m.elapsed===120000&&!g.over;
  if(m.mode==='attack'&&m.elapsed>120000||doneAt!==null&&Math.abs(doneAt-m.elapsed)>1||doneAt===null&&!completed)throw Error('unfinished');
  return {completed,elapsed:m.elapsed,score:g.score,lines:g.lines,pieces:g.pieces,tspins:g.tspins,tetrises:g.tetrises,perfects:g.perfects,maxCombo:g.maxCombo};
}
module.exports={verify};
if(require.main===module){let input='';process.stdin.on('data',v=>{input+=v;if(input.length>3000000)process.exit(1);});process.stdin.on('end',()=>{try{process.stdout.write(JSON.stringify(verify(JSON.parse(input))));}catch{process.exitCode=1;}});}
