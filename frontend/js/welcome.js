'use strict';
(() => {
  const $=s=>document.querySelector(s);let user=null,busy=false;
  const destination=(()=>{try{const u=new URL(new URLSearchParams(location.search).get('next')||'/play',location.origin);return u.origin===location.origin&&['/play','/battle','/account','/rankings'].includes(u.pathname)?u.pathname+u.search:'/play';}catch{return '/play';}})();
  const controls=()=>{document.querySelectorAll('.entry-primary,#guest-enter,#switch-account').forEach(b=>b.disabled=busy||!user);};
  async function refresh(){const r=await fetch('/api/me',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('서버에 연결하지 못했습니다. 새로고침해 주세요.');user=await r.json();const member=Boolean(user.username);$('#returning-user').hidden=!member;$('#entry-auth').hidden=member;$('#returning-name').textContent=user.nickname+'님, 다시 만나 반가워요.';controls();}
  async function action(path,data={},enter=true){if(busy||!user)return;busy=true;controls();$('#entry-status').textContent='잠시만 기다려 주세요…';try{
    const r=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':user.csrf},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'요청을 처리하지 못했습니다.');
    try{localStorage.setItem('ttrs-auth-change',String(Date.now()));}catch{}
    if(enter)location.assign(destination);else{await refresh();$('#entry-status').textContent='';}
  }catch(e){$('#entry-status').textContent=e.message;}finally{busy=false;controls();}}
  function tab(name){for(const v of ['login','register']){$('#tab-'+v).setAttribute('aria-selected',String(v===name));$('#entry-'+v).hidden=v!==name;}$('#entry-title').textContent=name==='login'?'다음 라운드를 시작하세요':'나만의 닉네임으로 시작하세요';$('#entry-status').textContent='';}
  $('#tab-login').onclick=()=>tab('login');$('#tab-register').onclick=()=>tab('register');
  $('#entry-login').onsubmit=e=>{e.preventDefault();action('/login',{username:$('#entry-username').value,password:$('#entry-password').value}).finally(()=>$('#entry-password').value='');};
  $('#entry-register').onsubmit=e=>{e.preventDefault();action('/register',{username:$('#new-username').value,nickname:$('#new-nickname').value,password:$('#new-password').value}).finally(()=>$('#new-password').value='');};
  $('#guest-enter').onclick=()=>action('/guest');$('#continue-button').onclick=()=>action('/guest');$('#switch-account').onclick=()=>action('/logout',{},false);
  $('#entry-security').hidden=location.protocol==='https:';
  refresh().then(()=>$('#entry-status').textContent='').catch(e=>$('#entry-status').textContent=e.message);
})();
