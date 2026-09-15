'use strict';
(() => {
  const $=s=>document.querySelector(s),store=TTRSPreferences,form=$('#preferences-form');
  let prefs=store.load(),dirty=false;
  $('#pref-skin').replaceChildren(...BlockSkins.catalog.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.name} · ${s.english}`;return o;}));
  function render() {
    for(const key of Object.keys(store.defaults)){const input=$(`#pref-${key}`);if(input.type==='checkbox')input.checked=prefs[key];else input.value=prefs[key];}
    for(const key of Object.keys(store.ranges))$(`#value-${key}`).textContent=key==='arr'&&prefs.arr===0?'즉시 (0 ms)':`${prefs[key]}${['das','arr'].includes(key)?' ms':'%'}`;
    $('#pref-ghostOpacity').disabled=!prefs.ghost;$('#pref-gridOpacity').disabled=!prefs.grid;
    const ctx=$('#settings-board').getContext('2d'),size=20;ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle=store.gridColor(prefs);ctx.fillRect(0,0,200,400);
    for(let y=0;y<20;y++)for(let x=0;x<10;x++){ctx.fillStyle=store.background(prefs);ctx.beginPath();ctx.roundRect(x*size+1,y*size+1,size-2,size-2,2);ctx.fill();}
    const g=new Tetris.Game();g.current=Tetris.clone('T');g.current.y=4;
    for(let y=19;y<22;y++)for(let x=0;x<10;x++)if(x<3||x>6)g.board[y][x]=['J','S','L'][(x+y)%3];
    g.board.forEach((row,y)=>row.forEach((type,x)=>{if(type&&y>=2)BlockSkins.draw(ctx,x*size,(y-2)*size,size,type,prefs.skin);}));
    if(prefs.ghost){const ghost={...g.current};while(!g.blocked(ghost,0,1))ghost.y++;for(const {x,y} of Tetris.cells(ghost))BlockSkins.draw(ctx,x*size,(y-2)*size,size,'T',prefs.skin,true,prefs.ghostOpacity);}
    for(const {x,y} of Tetris.cells(g.current))BlockSkins.draw(ctx,x*size,(y-2)*size,size,'T',prefs.skin);
  }
  form.addEventListener('input',e=>{const input=e.target,key=input.name;if(!Object.hasOwn(store.defaults,key))return;prefs[key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;prefs=store.normalize(prefs);dirty=true;$('#save-status').textContent='미리보기 중 · 설정 저장을 눌러 적용하세요.';render();});
  form.addEventListener('submit',e=>{e.preventDefault();const ok=store.save(prefs);dirty=!ok;$('#save-status').textContent=ok?'저장했습니다. 열려 있는 게임에도 적용됐어요.':'브라우저 저장소를 사용할 수 없어 저장하지 못했습니다. 저장소 허용 후 다시 시도해 주세요.';});
  $('#reset-preferences').onclick=()=>{prefs={...store.defaults};dirty=true;render();$('#save-status').textContent='기본값을 미리 보고 있습니다. 저장하면 적용됩니다.';};
  window.addEventListener('storage',e=>{if(e.key!==store.KEY&&e.key!==null)return;if(dirty){$('#save-status').textContent='다른 탭에서 설정이 변경됐습니다. 여기서 저장하면 현재 미리보기 값으로 덮어씁니다.';return;}prefs=store.load();render();$('#save-status').textContent='다른 탭에서 변경한 설정을 불러왔습니다.';});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  render();
})();
