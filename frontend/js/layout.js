/* Mouse-only edge resizing. Dimensions affect presentation, never physics. */
'use strict';
const layoutStyles=document.createElement('link');layoutStyles.rel='stylesheet';layoutStyles.href='/static/css/layout.css';document.head.append(layoutStyles);
(() => {
  const key='ttrs-layout-v1',p={board:300,chat:300,rail:300};
  try{const saved=JSON.parse(localStorage.getItem(key));for(const k of Object.keys(p))if(Number.isFinite(saved?.[k]))p[k]=saved[k];}catch{}
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function apply(){p.board=clamp(p.board,220,420);p.chat=clamp(p.chat,180,650);p.rail=clamp(p.rail,260,480);for(const [k,css] of [['board','--play-width'],['chat','--chat-height'],['rail','--rail-width']])document.documentElement.style.setProperty(css,p[k]+'px');}
  function save(){try{localStorage.setItem(key,JSON.stringify(p));}catch{}}
  function handles(target,kind){
    for(const edge of ['right','left','bottom','corner']){
      const h=document.createElement('span');h.className='resize-edge resize-'+edge;h.dataset.resize=kind+'-'+edge;h.title=kind==='board'?'드래그하여 보드 크기 조절':'드래그하여 채팅 크기 조절';h.setAttribute('aria-hidden','true');target.append(h);
      let drag=null;
      const finish=e=>{if(!drag||e?.pointerId!==undefined&&e.pointerId!==drag.id)return;const id=drag.id;drag=null;if(h.hasPointerCapture(id))h.releasePointerCapture(id);document.body.classList.remove('resizing');document.body.style.removeProperty('cursor');save();window.dispatchEvent(new Event('ttrs-resize-end'));};
      h.addEventListener('pointerdown',e=>{
        if(e.pointerType!=='mouse'||e.button!==0||drag)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();
        drag={id:e.pointerId,x:e.clientX,y:e.clientY,board:p.board,chat:p.chat,rail:p.rail};h.setPointerCapture(e.pointerId);const cursor=getComputedStyle(h).cursor;document.body.classList.add('resizing');document.body.style.cursor=cursor;window.dispatchEvent(new Event('ttrs-resize-start'));
      });
      h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=(e.clientX-drag.x)*(edge==='left'?-1:1),dy=e.clientY-drag.y;
        if(kind==='board')p.board=Math.round(drag.board+(edge==='bottom'?dy/2:edge==='corner'?(Math.abs(dx)>=Math.abs(dy/2)?dx:dy/2):dx));
        else{if(edge!=='bottom')p.rail=Math.round(drag.rail+dx);if(edge==='bottom'||edge==='corner')p.chat=Math.round(drag.chat+dy);}
        apply();
      });
      h.addEventListener('pointerup',finish);h.addEventListener('pointercancel',finish);h.addEventListener('lostpointercapture',finish);window.addEventListener('blur',()=>finish());
    }
  }
  const board=document.querySelector('.board-wrap');if(board){const frame=document.createElement('div');frame.className='resizable-board';board.before(frame);frame.append(board);handles(frame,'board');}
  const chat=document.querySelector('.chat-card');if(chat){chat.classList.add('resizable-chat');handles(chat,'chat');}
  apply();
})();
