/* Canvas-native block artwork. Rendering never changes the underlying game cells. */
(function(root) {
  "use strict";
  const catalog = [
    {id:"jelly",name:"젤리",english:"JELLY POP",description:"탱글탱글, 달콤한 컬러",tag:"반짝이는",swatch:"#eee7ff",palette:["#37bdd0","#eeb838","#a981e7","#67ba85","#ed8198","#699fe5","#eda25e"]},
    {id:"mochi",name:"모찌",english:"MOCHI FRIENDS",description:"볼이 발그레한 작은 친구들",tag:"귀여운",swatch:"#ffedf0",palette:["#73c9cf","#e9c668","#ba9adb","#94c49a","#e998aa","#94b4e3","#eeb58b"]},
    {id:"crystal",name:"크리스탈",english:"CRYSTAL CLUB",description:"빛을 머금은 작은 보석",tag:"우아한",swatch:"#e6f5fa",palette:["#44bace","#dcb547","#9a83d3","#5daf94","#dc7f9a","#659cda","#dd9c62"]},
    {id:"neon",name:"네온",english:"NEON STUDIO",description:"선명한 빛, 쿨한 존재감",tag:"멋있는",swatch:"#e9e9fb",palette:["#51e1ec","#ffe079","#c5a1ff","#8de3b1","#ff9caf","#95bbff","#ffbe87"]},
    {id:"retro",name:"레트로",english:"POCKET ARCADE",description:"손안의 작은 아케이드",tag:"경쾌한",swatch:"#fbf0dd",palette:["#32aaba","#dfac2f","#9979ca","#6fa771","#dc7481","#6e93c9","#d89050"]}
  ];
  const original=["#35c9d6","#f2d247","#a66be0","#52bd72","#e75656","#518ce2","#e99549"];
  const ids=["I","O","T","S","Z","J","L"];
  function get(id) {return catalog.find(s=>s.id===id)||catalog[0];}
  function color(id,value) {
    let index=ids.indexOf(value);
    if(index<0)index=original.indexOf(String(value).toLowerCase());
    return get(id).palette[index<0?0:index];
  }
  function rounded(ctx,x,y,w,h,r,fill,stroke) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.9;ctx.stroke();}
  }
  function draw(ctx,x,y,size,value,id="jelly",ghost=false) {
    const ink=color(id,value),skin=get(id).id,pad=size*.055,w=size-pad*2;
    ctx.save();ctx.translate(x+pad,y+pad);
    if(ghost) {
      const edge="#"+ink.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.68).toString(16).padStart(2,"0")).join("");
      ctx.globalAlpha*=.8;rounded(ctx,1,1,w-2,w-2,size*.19,ink+"16",edge);
      ctx.restore();return;
    }
    if(skin==="jelly") {
      rounded(ctx,0,size*.035,w,w-size*.035,size*.23,ink);
      const glaze=ctx.createLinearGradient(0,0,0,w);glaze.addColorStop(0,"#ffffff8a");glaze.addColorStop(.45,"#ffffff12");glaze.addColorStop(1,"#2c285426");
      rounded(ctx,0,0,w,w-size*.06,size*.23,glaze);
      rounded(ctx,size*.13,size*.1,w-size*.26,size*.17,size*.08,"#ffffff62");
      ctx.fillStyle="#ffffffba";ctx.beginPath();ctx.arc(w*.22,w*.31,size*.035,0,Math.PI*2);ctx.fill();
    } else if(skin==="mochi") {
      rounded(ctx,0,size*.035,w,w-size*.035,size*.28,"#61536a24");
      rounded(ctx,0,0,w,w-size*.05,size*.28,ink);
      rounded(ctx,size*.1,size*.075,w-size*.2,size*.14,size*.08,"#ffffff35");
      ctx.fillStyle="#493b57";
      for(const dx of [.34,.66]){ctx.beginPath();ctx.ellipse(w*dx,w*.47,size*.035,size*.048,0,0,Math.PI*2);ctx.fill();}
      ctx.strokeStyle="#71536c";ctx.lineWidth=Math.max(.8,size*.032);ctx.lineCap="round";
      ctx.beginPath();ctx.arc(w*.5,w*.56,size*.058,.05,Math.PI-.05);ctx.stroke();
      ctx.fillStyle="#ef71864f";
      for(const dx of [.19,.81]){ctx.beginPath();ctx.ellipse(w*dx,w*.6,size*.075,size*.044,0,0,Math.PI*2);ctx.fill();}
    } else if(skin==="crystal") {
      rounded(ctx,0,0,w,w,size*.15,ink);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);ctx.lineTo(w*.77,w*.23);ctx.lineTo(w*.23,w*.23);ctx.closePath();ctx.fillStyle="#ffffff95";ctx.fill();
      ctx.beginPath();ctx.moveTo(w,0);ctx.lineTo(w,w);ctx.lineTo(w*.77,w*.77);ctx.lineTo(w*.77,w*.23);ctx.closePath();ctx.fillStyle="#25365b26";ctx.fill();
      ctx.beginPath();ctx.moveTo(0,w);ctx.lineTo(w,w);ctx.lineTo(w*.77,w*.77);ctx.lineTo(w*.23,w*.77);ctx.closePath();ctx.fillStyle="#25365b38";ctx.fill();
      rounded(ctx,w*.23,w*.23,w*.54,w*.54,size*.05,"#ffffff22");
      ctx.strokeStyle="#ffffffcc";ctx.lineWidth=size*.035;ctx.beginPath();ctx.moveTo(w*.19,w*.3);ctx.lineTo(w*.19,w*.09);ctx.moveTo(w*.09,w*.19);ctx.lineTo(w*.3,w*.19);ctx.stroke();
    } else if(skin==="neon") {
      rounded(ctx,0,0,w,w,size*.2,"#35334f");
      ctx.shadowColor=ink;ctx.shadowBlur=size*.13;
      rounded(ctx,size*.08,size*.08,w-size*.16,w-size*.16,size*.13,null,ink);
      ctx.shadowBlur=0;
      const light=ctx.createLinearGradient(0,0,w,w);light.addColorStop(0,ink+"68");light.addColorStop(1,ink+"08");
      rounded(ctx,size*.13,size*.13,w-size*.26,w-size*.26,size*.1,light);
      rounded(ctx,size*.2,size*.16,w-size*.4,size*.06,size*.03,ink);
    } else {
      rounded(ctx,0,size*.055,w,w-size*.055,size*.09,"#574959");
      rounded(ctx,0,0,w,w-size*.105,size*.09,ink);
      ctx.fillStyle="#ffffff65";ctx.fillRect(size*.11,size*.1,w-size*.22,size*.065);ctx.fillRect(size*.1,size*.1,size*.065,w-size*.27);
      ctx.fillStyle="#4837472e";ctx.fillRect(size*.2,w-size*.22,w-size*.3,size*.07);
      rounded(ctx,size*.25,size*.25,w-size*.5,w-size*.5,size*.045,"#ffffff18","#473a5526");
    }
    ctx.restore();
  }
  const api={catalog,get,color,draw};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BlockSkins=api;
})(globalThis);
