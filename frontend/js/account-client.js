'use strict';
(() => {
  let user=null;
  async function refresh(){const r=await fetch('/api/me',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('사용자 정보를 불러오지 못했습니다.');user=await r.json();render();return user;}
  function render(){let strip=document.querySelector('.account-strip');if(!strip){strip=document.createElement('nav');strip.className='account-strip';strip.setAttribute('aria-label','계정 및 랭킹');document.querySelector('.topbar')?.after(strip);}strip.replaceChildren();const name=document.createElement('span');name.textContent=`${user.username?'● 회원':'○ 게스트'} · ${user.nickname}`;strip.append(name);for(const [label,url] of [[user.username?'내 계정':'로그인 / 가입','/account'],['랭킹','/rankings'],['플레이 기록','/account#records']]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener';strip.append(a);}}
  const ready=refresh();ready.catch(()=>{const note=document.createElement('p');note.className='status';note.textContent='계정 서버 연결 실패 · 새로고침해 주세요.';document.querySelector('.topbar')?.after(note);});
  async function api(path,data){await ready;const r=await fetch('/api'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':user.csrf},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(15000)});const value=await r.json();if(!r.ok)throw Error(typeof value.detail==='string'?value.detail:'요청을 처리하지 못했습니다.');return value;}
  window.TTRSAccount={ready,api,refresh,get user(){return user;}};
  window.addEventListener('storage',e=>{if(e.key==='ttrs-auth-change'){refresh().then(()=>window.dispatchEvent(new Event('ttrs-auth-change'))).catch(()=>{});}});
})();
