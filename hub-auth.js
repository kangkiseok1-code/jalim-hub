/* 자림 허브 로그인 — 로그인은 여기서만 하고, 앱은 같은 세션을 이어 쓴다 */
var SB_URL='https://vdnbnuxhjhckzrryvezl.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbmJudXhoamhja3pycnl2ZXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjkwNDUsImV4cCI6MjA5ODc0NTA0NX0.Z7HP_cmPkgxXAEjWoqk4fxLB-6Q7-tJrT8g50uTfKhE';
var sb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(SB_URL,SB_KEY):null;
var me=null, authMode='login';

/* 돌아갈 주소(next): 같은 도메인의 자림 앱 4곳만 허용 */
var ORIGIN='https://kangkiseok1-code.github.io';
var ALLOW=['/mating-app/','/counsel-tool/','/lotto-app/','/Team-maker/'];
function safeNext(raw){
  if(!raw) return null;
  try{
    var u=new URL(raw,ORIGIN);
    if(u.origin!==ORIGIN) return null;
    for(var i=0;i<ALLOW.length;i++) if(u.pathname.indexOf(ALLOW[i])===0) return u.href;
  }catch(e){}
  return null;
}
var NEXT=safeNext(new URLSearchParams(location.search).get('next'));

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
function afterAuth(){
  if(NEXT){location.replace(NEXT);return}
  closeSheet();
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
function accountSheet(){
  var u=me;
  openSheet(
    '<h2 style="margin-bottom:2px">내 계정</h2>'
   +'<p class="sub" style="margin:0">'+esc(displayName(u))+(u.email?' · '+esc(u.email):'')+'</p>'
   +'<div style="margin:10px 0 0"><span class="jn-chip ok">'+esc(providerLabel(u)||'로그인됨')+' 로그인 중</span></div>'
   +'<div class="jn-list">'
   +'<button class="jn-row" id="lo" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg><span class="jn-main">로그아웃</span></button>'
   +'<button class="jn-row quiet" id="lv" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg><span class="jn-main">회원 탈퇴<span class="jn-s">모든 앱의 계정과 기록이 영구 삭제돼요</span></span></button>'
   +'</div>');
  $('lo').onclick=doLogout;
  $('lv').onclick=confirmLeave;
}
async function doLogout(){
  await sb.auth.signOut();me=null;closeSheet();renderAccountChip();toast('로그아웃했어요');
}
function confirmLeave(){
  openSheet(
    '<h2 style="margin-bottom:4px">정말 탈퇴하시겠어요?</h2>'
   +'<p class="sub" style="margin:0 0 14px">만남·심화상담·재물운·팀메이커의 계정, 프로필, 저장한 기록이 모두 영구 삭제되고 되돌릴 수 없어요.</p>'
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
  var b=$('acct');
  if(me){
    b.innerHTML='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
    b.setAttribute('aria-label','내 계정');b.className='jn-iconbtn';b.onclick=accountSheet;
  }else{
    b.textContent='로그인';b.setAttribute('aria-label','로그인');b.className='btn sm';b.onclick=function(){authMode='login';loginSheet()};
  }
}

/* 시작 */
(async function(){
  renderAccountChip();
  if(!sb) return;
  var r=await sb.auth.getSession();
  me=(r.data&&r.data.session)?r.data.session.user:null;
  renderAccountChip();
  if(me&&NEXT){location.replace(NEXT);return}
  if(!me&&NEXT){authMode='login';loginSheet()}
  sb.auth.onAuthStateChange(function(ev,s){
    var u=s?s.user:null;
    if((u&&u.id)!==(me&&me.id)){me=u;renderAccountChip()}
  });
})();
