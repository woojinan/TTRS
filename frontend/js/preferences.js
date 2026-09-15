/* Shared local preferences. Display choices never alter game rules. */
(function(root) {
  'use strict';
  const KEY='ttrs-input-settings';
  const defaults=Object.freeze({das:133,arr:10,ghost:true,ghostOpacity:55,grid:true,gridOpacity:50,boardTheme:'midnight',skin:'jelly',effects:true,sfx:65,music:20,muted:false});
  const ranges={das:[0,300],arr:[0,100],ghostOpacity:[10,85],gridOpacity:[0,100],sfx:[0,100],music:[0,100]};
  const themes={midnight:[13,21,38],slate:[26,39,57],ocean:[12,37,57]};
  function normalize(raw) {
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},p={...defaults};
    for(const [key,[lo,hi]] of Object.entries(ranges))if(typeof source[key]==='number'&&Number.isFinite(source[key]))p[key]=Math.round(Math.max(lo,Math.min(hi,source[key])));
    for(const key of ['ghost','grid','effects','muted'])if(typeof source[key]==='boolean')p[key]=source[key];
    if(Object.hasOwn(themes,source.boardTheme))p.boardTheme=source.boardTheme;
    if(['jelly','mochi','crystal','neon','retro'].includes(source.skin))p.skin=source.skin;
    return p;
  }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)));}catch{return {...defaults};}}
  function save(p){try{localStorage.setItem(KEY,JSON.stringify(normalize(p)));return true;}catch{return false;}}
  const hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  function background(p){return hex(themes[p.boardTheme]||themes.midnight);}
  function gridColor(p){const rgb=themes[p.boardTheme]||themes.midnight,amount=p.grid?p.gridOpacity/100:0;return hex(rgb.map((v,i)=>v+([89,123,176][i]-v)*amount));}
  const api={KEY,defaults,ranges,normalize,load,save,background,gridColor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TTRSPreferences=api;
})(globalThis);
