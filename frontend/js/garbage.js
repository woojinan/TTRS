'use strict';
(() => {
  const frame=document.querySelector('.resizable-board'),board=document.querySelector('.board-wrap');
  const rail=document.createElement('div');rail.className='garbage-rail';rail.id='garbage-rail';rail.setAttribute('role','meter');rail.setAttribute('aria-label','보드 높이 기준 대기 공격줄');rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');
  const segments=Array.from({length:20},()=>document.createElement('i'));rail.append(...segments);frame.append(rail);
  const forecast=document.createElement('div');forecast.className='garbage-forecast';forecast.id='garbage-forecast';const label=document.createElement('span');forecast.append(label);board.append(forecast);
  function render(pending=0,mature=0){pending=Math.max(0,Math.min(100,Number(pending)||0));mature=Math.max(0,Math.min(pending,Number(mature)||0));
    segments.forEach((s,i)=>s.dataset.state=i<mature?'ready':i<pending?'warning':'empty');
    rail.setAttribute('aria-valuenow',String(pending));rail.setAttribute('aria-valuetext',`대기 ${pending}줄 · 예고 완료 ${mature}줄 · 다음 미삭제 착지 최대 ${Math.min(8,mature)}줄 상승`);
    forecast.hidden=!pending;forecast.style.height=Math.min(20,pending)*5+'%';forecast.dataset.ready=String(mature>0);label.textContent=pending+'줄'+(pending>20?' · 보드 초과':'');forecast.title=rail.getAttribute('aria-valuetext');
  }
  window.TTRSGarbage={render};render();
})();
