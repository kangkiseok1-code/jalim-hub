/* 자림 허브 로그인 — 로그인은 여기서만 하고, 앱은 같은 세션을 이어 쓴다 */
var SB_URL='https://vdnbnuxhjhckzrryvezl.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbmJudXhoamhja3pycnl2ZXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjkwNDUsImV4cCI6MjA5ODc0NTA0NX0.Z7HP_cmPkgxXAEjWoqk4fxLB-6Q7-tJrT8g50uTfKhE';
var sb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(SB_URL,SB_KEY):null;
var me=null, authMode='login';

/* 돌아갈 주소(next): 같은 도메인의 자림 앱 4곳만 허용 */
var ORIGIN='https://kangkiseok1-code.github.io';
var ALLOW=['/mating-app/','/analysis-app/','/counsel-tool/','/lotto-app/','/Team-maker/','/life-walk/','/checkin/'];
function safeNext(raw){
  if(!raw) return null;
  try{
    var u=new URL(raw,ORIGIN);
    if(u.origin!==ORIGIN) return null;
    for(var i=0;i<ALLOW.length;i++) if(u.pathname.indexOf(ALLOW[i])===0) return u.href;
  }catch(e){}
  return null;
}
/* 카카오 등 외부 로그인에서 방금 돌아왔는지(주소에 인증 정보가 붙어 있음) — supabase가 주소를 지우기 전에 기록 */
var FRESH_LOGIN=/[?&]code=|access_token=/.test(location.search+location.hash);
var NEXT=safeNext(new URLSearchParams(location.search).get('next'));
/* ?manage=counsel : 관리자가 심화상담 신청 관리 화면을 바로 열고 싶을 때(심화상담 홈의 "승인 대기" 줄에서 옴) */
var MANAGE=new URLSearchParams(location.search).get('manage')==='counsel';

function $(id){return document.getElementById(id)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function toast(t){var e=document.createElement('div');e.className='jn-toast';e.textContent=t;e.style.bottom='max(28px,env(safe-area-inset-bottom))';document.body.appendChild(e);setTimeout(function(){e.classList.add('out')},1600);setTimeout(function(){e.remove()},1900)}
function normEmail(s){return (s||'').replace(/[！-～]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0)}).replace(/\s+/g,'').toLowerCase()}
var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function status(t,kind){var s=$('st');if(s){s.textContent=t||'';s.className='status'+(kind?' '+kind:'')}}

/* 시트 */
var sheetEl=null,scrimEl=null;
function openSheet(html){
  closeSheet(true);
  scrimEl=document.createElement('div');scrimEl.className='jn-scrim';
  sheetEl=document.createElement('div');sheetEl.className='jn-sheet';
  sheetEl.setAttribute('role','dialog');sheetEl.setAttribute('aria-modal','true');
  sheetEl.innerHTML=html;
  document.body.append(scrimEl,sheetEl);
  scrimEl.onclick=function(){closeSheet()};
}
function closeSheet(now){
  var s=sheetEl,c=scrimEl; sheetEl=scrimEl=null;
  if(!s) return;
  if(now){s.remove();c.remove();return}
  s.classList.add('out');c.classList.add('out');
  setTimeout(function(){s.remove();c.remove()},220);
}

/* 로그인 시트 */
var KAKAO_SVG='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.77 1.85 5.2 4.64 6.58l-.95 3.48c-.08.3.26.54.52.37l4.13-2.74c.54.06 1.1.1 1.66.1 5.52 0 10-3.48 10-7.79C22 6.48 17.52 3 12 3z"/></svg>';
function loginSheet(){
  var su=authMode==='signup';
  openSheet(
    '<h2 style="margin-bottom:4px">'+(su?'회원가입':'로그인')+'</h2>'
   +'<p class="sub" style="margin:0 0 12px">한 번 로그인하면 자림의 모든 앱에서 같은 계정을 써요.</p>'
   +'<button class="btn kakao" id="kk" type="button">'+KAKAO_SVG+'카카오로 '+(su?'시작하기':'로그인')+'</button>'
   +'<div class="or"><span>또는 이메일로</span></div>'
   +'<label>이메일</label><input type="email" id="em" placeholder="you@example.com" autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false">'
   +'<label>비밀번호 <span class="opt">(6자 이상)</span></label><input type="password" id="pw" placeholder="••••••" autocomplete="'+(su?'new-password':'current-password')+'">'
   +(su?'<label>비밀번호 확인</label><input type="password" id="pw2" placeholder="한 번 더 입력" autocomplete="new-password">':'')
   +'<div id="st" class="status" role="status"></div>'
   +'<button class="btn" id="go" type="button" style="width:100%;margin-top:6px">'+(su?'가입하고 시작하기':'로그인')+'</button>'
   +'<p class="sub" style="text-align:center;margin:14px 0 0">'+(su?'이미 계정이 있으세요? ':'계정이 없으세요? ')+'<span class="switch" id="sw" role="button" tabindex="0">'+(su?'로그인':'회원가입')+'</span></p>');
  $('kk').onclick=doKakao;
  $('go').onclick=su?doSignup:doLogin;
  $('sw').onclick=function(){authMode=su?'login':'signup';loginSheet()};
  $(su?'pw2':'pw').onkeydown=function(e){if(e.key==='Enter')$('go').click()};
}
/* 로그인 성공 표시: 체크가 그려진 뒤 0.7초 있다가 이동·닫기. 움직임 줄이기면 바로 진행 */
function showDone(msg,after){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){after();return}
  if(!sheetEl){openSheet('')}
  sheetEl.style.minHeight='220px';
  sheetEl.innerHTML='<div class="done" role="status"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="jm-pop" cx="26" cy="26" r="23"/><path class="jm-draw" pathLength="1" d="M15 27l8 8 14-16"/></svg><b>'+esc(msg)+'</b></div>';
  setTimeout(after,700);
}
function closeDoneSheet(){ if(sheetEl&&sheetEl.querySelector('.done')) closeSheet(); }   // 로그인 성공 표시만 닫는다
function afterAuth(){
  showDone('로그인됐어요',function(){
    if(NEXT){location.replace(NEXT);return}
    closeDoneSheet();
  });
}
async function doKakao(){
  if(!sb){status('연결할 수 없어요. 잠시 뒤 다시 시도해주세요','err');return}
  status('카카오로 이동 중…');
  var q=NEXT?'?next='+encodeURIComponent(NEXT):'';
  var r=await sb.auth.signInWithOAuth({provider:'kakao',options:{redirectTo:location.origin+location.pathname+q}});
  if(r.error) status('카카오 로그인 실패: '+r.error.message,'err');
}
async function doLogin(){
  var email=normEmail($('em').value),password=$('pw').value;
  if(!email||!password){status('이메일과 비밀번호를 입력하세요','err');return}
  if(!EMAIL_RE.test(email)){status('이메일 형식을 확인해주세요 (예: name@example.com)','err');return}
  if(!sb){status('연결할 수 없어요. 잠시 뒤 다시 시도해주세요','err');return}
  status('로그인 중…');
  var r=await sb.auth.signInWithPassword({email:email,password:password});
  if(r.error){status('로그인 실패: '+r.error.message,'err');return}
  me=r.data.user;renderAccountChip();afterAuth();
}
async function doSignup(){
  var email=normEmail($('em').value),password=$('pw').value,p2=$('pw2').value;
  if(!email||password.length<6){status('이메일과 6자 이상 비밀번호를 입력하세요','err');return}
  if(!EMAIL_RE.test(email)){status('이메일 형식을 확인해주세요 (예: name@example.com)','err');return}
  if(password!==p2){status('비밀번호가 일치하지 않습니다. 확인란을 다시 입력해주세요','err');return}
  if(!sb){status('연결할 수 없어요. 잠시 뒤 다시 시도해주세요','err');return}
  status('가입 중…');
  var r=await sb.auth.signUp({email:email,password:password});
  if(r.error){status('가입 실패: '+r.error.message,'err');return}
  if(r.data.session){me=r.data.session.user;renderAccountChip();afterAuth()}
  else status('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.','ok');
}

/* 내 계정 시트 */
function providerLabel(u){
  var p=(u.app_metadata&&u.app_metadata.provider)||'';
  return p==='kakao'?'카카오':(p==='email'?'이메일':p);
}
function displayName(u){
  var m=u.user_metadata||{};
  return m.name||m.full_name||m.nick_name||m.preferred_username||(u.email?u.email.split('@')[0]:'회원');
}
function accessChipHtml(){
  if(!access.loaded||access.admin) return access.admin?' <span class="jn-chip">관리자</span>':'';
  var s=access.counsel;
  return ' <span class="jn-chip '+(s==='approved'?'ok':s==='pending'?'warn':s==='rejected'?'bad':'')+'">심화상담 '+(s==='approved'?'이용 가능':s==='pending'?'승인 대기':s==='rejected'?'승인 안 됨':'신청 전')+'</span>';
}
function accountSheet(){
  var u=me;
  openSheet(
    '<h2 style="margin-bottom:2px">내 계정</h2>'
   +'<p class="sub" style="margin:0">'+esc(displayName(u))+(u.email?' · '+esc(u.email):'')+'</p>'
   +'<div style="margin:10px 0 0"><span class="jn-chip ok">'+esc(providerLabel(u)||'로그인됨')+' 로그인 중</span>'+accessChipHtml()+'</div>'
   +'<div id="shared"></div>'
   +'<div class="jn-list">'
   +(access.admin?'<button class="jn-row" id="adm" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg><span class="jn-main">심화상담 신청 관리<span class="jn-s">승인·거절</span></span>'+(pendingCount()?'<span class="jn-badge">'+pendingCount()+'</span>':'')+'</button>':'')
   +'<button class="jn-row" id="lo" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg><span class="jn-main">로그아웃</span></button>'
   +'<button class="jn-row quiet" id="lv" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg><span class="jn-main">회원 탈퇴<span class="jn-s">모든 앱의 계정과 기록이 영구 삭제돼요</span></span></button>'
   +'</div>');
  $('lo').onclick=doLogout;
  $('lv').onclick=confirmLeave;
  if($('adm')) $('adm').onclick=adminSheet;
  loadShared();
}

/* 내 정보 공유 — 인생 다시 걷기에서 동의하고 저장한 '공용 출생정보'(core_profiles), 걷기 기록(journey_answers), 기운 체크인 기록(daily_checkins).
   모두 본인만 읽고 지울 수 있다. 동의 철회 = 공용 출생정보 삭제(각 앱에 따로 입력한 정보·걷기 기록은 그대로). */
var SMILE='<circle cx="12" cy="12" r="8.5"/><path d="M8.5 13.5c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3M9 9.5h.01M15 9.5h.01"/>', SHIELD='<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>', FOOT='<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6-2.5-2.5 1.5-4 3 1.5 2 3.5M12 15l3 6M9.5 10.5L7 12"/>';
async function loadShared(){
  var box=$('shared'); if(!box||!sb||!me) return;
  var uid=me.id;
  try{
    var c=await sb.from('core_profiles').select('nickname,birth_y,birth_mo,birth_d,birth_city').eq('user_id',uid).maybeSingle();
    var a=await sb.from('journey_answers').select('year').eq('user_id',uid);
    var k=await sb.from('daily_checkins').select('day').eq('user_id',uid);
    if(c.error||a.error) return;
    if(!$('shared')||!me||me.id!==uid) return;   // 그사이 시트가 닫히거나 계정이 바뀜
    var core=c.data, n=(a.data||[]).length, kn=k.error?0:(k.data||[]).length, h='';
    if(core){
      var who=(core.nickname?core.nickname+' · ':'')+core.birth_y+'.'+core.birth_mo+'.'+core.birth_d+(core.birth_city?' · '+core.birth_city:'');
      h+='<button class="jn-row" id="wd" type="button"><svg class="ic" viewBox="0 0 24 24">'+SHIELD+'</svg><span class="jn-main">공용 출생정보 동의 철회<span class="jn-s">'+esc(who)+' · 다른 앱이 자동으로 쓰는 걸 멈춰요</span></span></button>';
    }
    if(n) h+='<button class="jn-row" id="wa" type="button"><svg class="ic" viewBox="0 0 24 24">'+FOOT+'</svg><span class="jn-main">걷기 기록 지우기<span class="jn-s">인생 다시 걷기에서 남긴 '+n+'곳</span></span></button>';
    if(kn) h+='<button class="jn-row" id="wk" type="button"><svg class="ic" viewBox="0 0 24 24">'+SMILE+'</svg><span class="jn-main">기운 기록 지우기<span class="jn-s">기운 체크인에서 남긴 '+kn+'일</span></span></button>';
    box.innerHTML=h
      ?'<p class="sec-label" style="margin:16px 2px 4px">내 정보 공유</p><div class="jn-list">'+h+'</div>'
      :'<p class="sub" style="margin:14px 0 0;font-size:.8rem">저장된 공용 출생정보가 없어요. 인생 다시 걷기에서 동의하면 다른 앱에서도 자동으로 채워져요.</p>';
    if($('wd')) $('wd').onclick=function(){confirmShared('core',who)};
    if($('wa')) $('wa').onclick=function(){confirmShared('answers',n)};
    if($('wk')) $('wk').onclick=function(){confirmShared('checkins',kn)};
  }catch(e){}
}
function confirmShared(kind,info){
  var w=kind==='core', q=kind==='checkins';
  openSheet(
    '<h2 style="margin-bottom:4px">'+(w?'동의를 철회할까요?':q?'기운 기록을 지울까요?':'걷기 기록을 지울까요?')+'</h2>'
   +'<p class="sub" style="margin:0 0 14px">'+(w
     ?'자림에 저장된 공용 출생정보('+esc(info)+')가 삭제돼요. 만남·재물운 등 각 앱에 따로 입력해 둔 정보와 걷기 기록은 그대로예요. 나중에 인생 다시 걷기에서 다시 동의하고 저장할 수 있어요.'
     :q?'기운 체크인에서 남긴 기록 '+esc(info)+'일이 모두 삭제되고 되돌릴 수 없어요. 이 기기에 남은 기록은 앱에서 따로 지울 수 있어요.'
     :'인생 다시 걷기에서 남긴 답 '+esc(info)+'곳이 모두 삭제되고 되돌릴 수 없어요. 이 기기에 남은 기록은 앱에서 따로 지울 수 있어요.')+'</p>'
   +'<div id="st" class="status" role="status"></div>'
   +'<div style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" id="no" type="button">취소</button><button class="btn danger" style="flex:1" id="yes" type="button">'+(w?'철회하기':'지우기')+'</button></div>');
  $('no').onclick=accountSheet;
  $('yes').onclick=async function(){
    $('yes').disabled=true; status('처리 중…');
    var r=await sb.from(w?'core_profiles':q?'daily_checkins':'journey_answers').delete().eq('user_id',me.id);
    if(r.error){status('처리하지 못했어요: '+r.error.message,'err');$('yes').disabled=false;return}
    toast(w?'동의를 철회했어요':q?'기운 기록을 지웠어요':'걷기 기록을 지웠어요'); accountSheet();
  };
}
async function doLogout(){
  await sb.auth.signOut();me=null;closeSheet();renderAccountChip();toast('로그아웃했어요');
}
function confirmLeave(){
  openSheet(
    '<h2 style="margin-bottom:4px">정말 탈퇴하시겠어요?</h2>'
   +'<p class="sub" style="margin:0 0 14px">만남·심화상담·재물운·팀메이커의 계정, 프로필, 공용 출생정보, 걷기 기록, 기운 체크인 기록, 저장한 기록이 모두 영구 삭제되고 되돌릴 수 없어요.</p>'
   +'<div id="st" class="status" role="status"></div>'
   +'<div style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" id="no" type="button">취소</button><button class="btn danger" style="flex:1" id="yes" type="button">탈퇴하기</button></div>');
  $('no').onclick=accountSheet;
  $('yes').onclick=async function(){
    status('탈퇴 처리 중…');
    var r=await sb.rpc('delete_me');
    if(r.error){status('탈퇴 실패: '+r.error.message,'err');return}
    await sb.auth.signOut();me=null;closeSheet();renderAccountChip();toast('탈퇴가 완료됐어요');
  };
}

/* 상단 계정 버튼 */
function renderAccountChip(){
  var b=$('acct'); renderShareBtn();
  if((me?me.id:null)!==access.uid) refreshAccess();
  if(me){
    b.innerHTML='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
    b.setAttribute('aria-label','내 계정');b.className='jn-iconbtn';b.onclick=accountSheet;
  }else{
    b.textContent='로그인';b.setAttribute('aria-label','로그인');b.className='btn sm';b.onclick=function(){authMode='login';loginSheet()};
  }
}

/* 공유하기 — 분석 앱이 내 분석을 열 때 이 브라우저(같은 사이트 저장소)에 남겨 둔 내 타입 카드 링크를 보낸다. 한 번도 안 열었으면 버튼이 안 보인다 */
function renderShareBtn(){
  var sb=$('hshare'); if(!sb) return;
  var rec=null; try{ rec=me?JSON.parse(localStorage.getItem('jalim_share_'+me.id)||'null'):null }catch(e){}
  sb.hidden=!(rec&&rec.url);
  sb.onclick=async function(){
    var text='내 사주 타입은 '+(rec.name||'')+'! 나도 해보기';
    if(navigator.share){ try{ await navigator.share({title:'내 타입 카드',text:text,url:rec.url}) }catch(_){} return }
    try{ await navigator.clipboard.writeText(rec.url); toast('링크가 복사됐어요') }catch(_){ prompt('아래 링크를 복사해 보내세요',rec.url) }
  };
}

/* 앱 입장 승인 — 심화상담(counsel)만 승인제: 가입 → 정보공유 동의 신청 → 관리자 승인 → 입장 */
var CONSENT_VER='counsel-v2-2026-10-24';
var access={uid:null,loaded:false,admin:false,counsel:null,row:null,list:[]};   // counsel: null|'pending'|'approved'|'rejected'
function counselState(){ return access.admin?'approved':access.counsel; }
async function refreshAccess(){
  var uid=me?me.id:null;
  if(typeof refreshToday==='function') refreshToday();   // 오늘의 기운 카드도 계정이 바뀔 때 함께 새로 그린다
  access={uid:uid,loaded:false,admin:false,counsel:null,row:null,list:[]};
  renderGate();
  if(!sb||!me) return;
  try{
    var a=await sb.rpc('is_jalim_admin'); access.admin=a.data===true;
    var q=await sb.from('app_access').select('status,requested_at,decided_at').eq('app','counsel').eq('user_id',me.id).maybeSingle();
    access.row=q.data||null; access.counsel=q.data?q.data.status:null;
    if(access.admin){ var l=await sb.rpc('list_app_access',{p_app:'counsel'}); access.list=l.data||[]; }
  }catch(e){}
  if(access.uid!==uid) return;   // 그사이 다른 계정으로 바뀜
  access.loaded=true; renderGate();
  openManageIfRequested();
}
function openManageIfRequested(){
  if(!MANAGE||!me) return;
  MANAGE=false;
  try{ history.replaceState(null,'',location.pathname+location.hash); }catch(e){}   // 새로고침해도 다시 열리지 않게 주소에서 지운다
  if(access.admin) adminSheet(); else toast('관리자만 열 수 있어요');
}
function pendingCount(){ return access.list.filter(function(x){return x.status==='pending'}).length }
/* 카드의 상태 표시 */
function renderGate(){
  var chip=document.getElementById('gate-counsel'); if(!chip) return;
  var t='',k='warn';
  if(me&&access.loaded){
    if(access.admin){ var n=pendingCount(); if(n) t='신청 '+n+'건' }
    else if(access.counsel==='pending') t='승인 대기';
    else if(access.counsel==='rejected'){t='승인 안 됨';k='bad'}
    else if(access.counsel!=='approved') t='신청 필요';
  }
  chip.textContent=t; chip.className='jn-chip '+k; chip.hidden=!t;
}
/* 카드 누르기: 승인된 사람만 앱으로, 나머지는 안내 시트 */
function onGateClick(e){
  var card=e.target.closest&&e.target.closest('.card[data-gate]'); if(!card||e.target.closest('.info')) return;
  if(access.admin&&access.loaded&&pendingCount()&&e.target.closest('#gate-counsel')){ e.preventDefault(); adminSheet(); return; }
  if(!me){ e.preventDefault(); authMode='login'; loginSheet(); return; }
  if(!access.loaded){ e.preventDefault(); toast('확인 중이에요. 잠시 뒤 다시 눌러주세요'); return; }
  if(counselState()==='approved') return;   // 그대로 이동
  e.preventDefault(); counselSheet();
}
function counselSheet(){
  var s=access.counsel;
  if(s==='pending'){
    openSheet('<h2 style="margin-bottom:4px">승인을 기다리고 있어요</h2>'
     +'<p class="sub" style="margin:0 0 14px">심화상담 이용 신청이 접수됐어요. 상담사가 확인하면 바로 이용할 수 있어요.'+(access.row&&access.row.requested_at?'<br>신청일 '+esc(access.row.requested_at.slice(0,10)):'')+'</p>'
     +'<button class="btn" id="ok" type="button" style="width:100%">확인</button>');
    $('ok').onclick=function(){closeSheet()}; return;
  }
  var again=s==='rejected';
  openSheet('<h2 style="margin-bottom:4px">'+(again?'이번에는 승인되지 않았어요':'심화상담 이용 신청')+'</h2>'
   +'<p class="sub" style="margin:0 0 12px">'+(again?'다시 신청하면 상담사가 한 번 더 확인해요.':'심화상담은 상담사가 승인한 회원만 이용할 수 있어요. 신청하면 승인 결과가 이 화면에 표시돼요.')+'</p>'
   +'<div class="consent"><b>정보 제공 동의 (필수)</b>'
   +'<p>신청하면 내가 입력하는 <b>생년월일시·출생지·상담 질문 답변·인생 사건</b>을 상담사가 상담을 위해 확인하는 것에 동의하는 것으로 봅니다.</p>'
   +'<p>상담을 보낼 때 <b>분석 앱의 성향·대인관계 결과, 지인 평가 요약, 인생 다시 걷기 기록</b>도 함께 보낼 수 있어요. 지인 평가는 응답을 평균으로 합친 요약만 가고, 응답한 지인의 이름·관계는 가지 않아요. 보내기 전에 항목마다 직접 고르며, 고르지 않은 것은 전달되지 않아요.</p>'
   +'<p>동의는 언제든 회원 탈퇴로 철회할 수 있고, 탈퇴하면 기록이 모두 삭제돼요.</p></div>'
   +'<label class="chk"><input type="checkbox" id="agree"> 위 내용에 동의합니다</label>'
   +'<div id="st" class="status" role="status"></div>'
   +'<button class="btn" id="req" type="button" style="width:100%;margin-top:6px" disabled>'+(again?'다시 신청하기':'신청하기')+'</button>');
  $('agree').onchange=function(){$('req').disabled=!$('agree').checked};
  $('req').onclick=async function(){
    $('req').disabled=true; status('신청 중…');
    var r=await sb.rpc('request_app_access',{p_app:'counsel',p_consent_version:CONSENT_VER});
    if(r.error){status('신청하지 못했어요: '+r.error.message,'err');$('req').disabled=false;return}
    await refreshAccess(); closeSheet(); toast('신청했어요. 승인되면 이용할 수 있어요');
  };
}
/* 관리자: 신청 관리 */
function adminSheet(){
  var L=access.list, rows=L.map(function(x){
    var name=x.nickname||(x.email?x.email.split('@')[0]:'(이름 없음)');
    var chip=x.status==='pending'?'<span class="jn-chip warn">대기</span>':x.status==='approved'?'<span class="jn-chip ok">승인</span>':'<span class="jn-chip bad">거절</span>';
    var when=(x.requested_at||'').slice(0,10);
    var btns=x.status==='pending'?'<button class="btn sm" data-uid="'+esc(x.user_id)+'" data-act="approved" type="button">승인</button><button class="btn sm ghost" data-uid="'+esc(x.user_id)+'" data-act="rejected" type="button">거절</button>'
      :x.status==='approved'?'<button class="btn sm ghost" data-uid="'+esc(x.user_id)+'" data-act="rejected" type="button">승인 취소</button>'
      :'<button class="btn sm ghost" data-uid="'+esc(x.user_id)+'" data-act="approved" type="button">승인</button>';
    return '<div class="arow"><div class="ainfo"><b>'+esc(name)+'</b>'+chip+'<span class="sub">'+esc(x.email||'')+(when?' · '+esc(when):'')+'</span></div><div class="aact">'+btns+'</div></div>';
  }).join('');
  openSheet('<h2 style="margin-bottom:4px">심화상담 신청 관리</h2>'
   +'<p class="sub" style="margin:0 0 10px">대기 중인 신청이 위에 나와요.</p>'
   +'<div id="st" class="status" role="status"></div>'
   +(rows||'<p class="sub">아직 신청이 없어요.</p>'));
  sheetEl.querySelectorAll('[data-uid]').forEach(function(b){ b.onclick=async function(){
    var act=b.getAttribute('data-act'); b.disabled=true; status('처리 중…');
    var r=await sb.rpc('decide_app_access',{p_user:b.getAttribute('data-uid'),p_app:'counsel',p_status:act});
    if(r.error){status('처리하지 못했어요: '+r.error.message,'err');b.disabled=false;return}
    await refreshAccess(); adminSheet(); toast(act==='approved'?'승인했어요':'거절했어요');
  }; });
}

/* 시작 */
document.addEventListener('click',onGateClick,true);   // 카드 링크보다 먼저 받는다
(async function(){
  renderAccountChip();
  if(!sb) return;
  var r=await sb.auth.getSession();
  me=(r.data&&r.data.session)?r.data.session.user:null;
  renderAccountChip();
  if(me&&FRESH_LOGIN){showDone('로그인됐어요',function(){if(NEXT)location.replace(NEXT);else closeDoneSheet()});return}   // 카카오 등에서 방금 돌아옴
  if(me&&NEXT){location.replace(NEXT);return}
  if(!me&&(NEXT||MANAGE)){authMode='login';loginSheet()}
  sb.auth.onAuthStateChange(function(ev,s){
    var u=s?s.user:null;
    if((u&&u.id)!==(me&&me.id)){me=u;renderAccountChip()}
  });
})();
