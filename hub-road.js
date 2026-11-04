/* 허브 첫 화면의 '길' — 로그인한 사람에게 앱 목록 대신 "여기까지 왔어요 → 다음은 여기"를 한 폭의 그림으로 보여 준다.
 *   사주 입력 → 인생 다시 걷기 → 나의 흐름 → 나를 더 알아보기 → (운세 체크인 달력 곁가지) → 심화 상담.
 * 읽기만 한다(내 정보 표 4개). 로그인 전 화면과 오늘의 기운 카드는 그대로 둔다.
 * 그림(길·노드·이야기 점)은 hub-road-art.js. 쓰는 전역: me, sb, access, esc, BASE, ANALYSIS_URL, loadBirthCandidates (hub-auth.js · hub-today.js · index.html) */
var roadData={uid:null,loaded:false,core:false,nick:'',walk:0,checkins:0,today:null,recent:[]};
var roadRun=0;

function roadTodayKey(){ var t=new Date(), p=function(n){return (n<10?'0':'')+n}; return t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate()); }

/* 로그인한 사람의 진행 상황을 읽어 온다. 일부 실패해도 나머지로 그린다 */
async function loadRoadData(){
  var uid=me?me.id:null, run=++roadRun;
  roadData={uid:uid,loaded:false,core:false,nick:'',walk:0,checkins:0,today:null,recent:[]};
  renderRoad();
  if(!sb||!me) return;
  var d={uid:uid,loaded:true,core:false,nick:'',walk:0,checkins:0,today:null,recent:[]};
  try{
    var cands=await loadBirthCandidates();
    d.core=cands.length>0; d.nick=(cands.filter(function(c){return c.nickname})[0]||{}).nickname||'';
  }catch(e){}
  try{ var w=await sb.from('journey_answers').select('year',{count:'exact',head:true}).eq('user_id',uid); d.walk=w.count||0; }catch(e){}
  try{
    var k=await sb.from('daily_checkins').select('day,score').eq('user_id',uid).order('day',{ascending:false}).limit(60);
    var rows=(k.data||[]).filter(function(r){return r.score});
    d.checkins=rows.length; var tk=roadTodayKey();
    d.today=rows.filter(function(r){return String(r.day).slice(0,10)===tk})[0]||null;
    var ks=['','','','',''], back=function(n){var t=new Date(); t.setDate(t.getDate()-n); var p=function(x){return (x<10?'0':'')+x}; return t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate());};
    d.recent=[4,3,2,1,0].map(function(n){return rows.some(function(r){return String(r.day).slice(0,10)===back(n)})});
  }catch(e){}
  if(run!==roadRun||!me||me.id!==uid) return;
  roadData=d; renderRoad();
}

/* 관리자 버튼: 공유하기 옆에 같은 모양으로. 관리자 로그인일 때만 보이고, 누르면 관리 메뉴(심화상담 신청 관리 · 팀메이커) */
function renderAdminBtn(){
  var host=document.querySelector('.head-acts'); if(!host) return;
  var b=document.getElementById('hadmin'), on=!!(me&&access&&access.admin&&access.loaded);
  if(!on){ if(b) b.remove(); return; }
  if(!b){
    b=document.createElement('button'); b.id='hadmin'; b.type='button'; b.className='btn sm'; b.onclick=adminMenuSheet;
    var ref=document.getElementById('hshare'); host.insertBefore(b,ref?ref.nextSibling:host.firstChild);
  }
  var n=pendingCount(); b.textContent='관리자'+(n?' '+n:''); b.setAttribute('aria-label','관리자 메뉴'+(n?', 승인 대기 '+n+'건':''));
}
function adminMenuSheet(){
  var n=pendingCount();
  openSheet('<h2 style="margin-bottom:4px">관리자</h2><p class="sub" style="margin:0 0 8px">관리자에게만 보여요</p><div class="jn-list">'
   +'<button class="jn-row" id="am-c" type="button"><svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg><span class="jn-main">심화상담 신청 관리<span class="jn-s">승인 대기 '+n+'건</span></span>'+(n?'<span class="jn-badge">'+n+'</span>':'')+'</button>'
   +'<button class="jn-row" id="am-t" type="button"><svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c1.8.7 3 2.6 3.5 5.5"/></svg><span class="jn-main">팀메이커<span class="jn-s">관리자 전용</span></span></button></div>');
  document.getElementById('am-c').onclick=adminSheet;
  document.getElementById('am-t').onclick=function(){ location.href=BASE+'Team-maker/team-maker.html'; };
}
/* 지도를 한 번 그린 뒤에는 부가 기능(이야기 점·관리자 버튼·안내 배너)이 잘못돼도 지도를 숨기지 않는다.
 * 지도 자체를 못 그리면 오류 문구를 보여 주고(원인 확인용), 아래에 예전 카드 목록이 남아 허브를 쓸 수 있다. */
function roadFail(box,e){
  try{ console.error('허브 지도 오류',e); }catch(_){}
  document.body.classList.remove('in-road'); box.hidden=false;
  box.innerHTML='<div class="road-err" role="alert">지도를 그리지 못했어요 <small>'+esc(String(e&&e.message||e))+'</small> <button class="btn sm" type="button" onclick="location.reload()">새로고침</button></div>';
}
function roadSafe(fn){ try{ fn(); }catch(e){ try{ console.error('허브 지도 부가 기능 오류',e); }catch(_){} } }
function renderRoad(){
  var box=document.getElementById('road'); if(!box) return;
  var html;
  try{
    var d=(me&&roadData.uid===me.id)?roadData:{core:false,walk:0,checkins:0,today:null,recent:[false,false,false,false,false],nick:''};
    html='<h2 class="road-h">'+(me?(d.nick?esc(d.nick)+'님, ':'')+'오늘은 여기까지 와 있어요':'나를 알아가는 길')+'</h2>'+roadArtHtml(d);
    if(typeof idleBannerHtml==='function') html=idleBannerHtml()+html;
  }catch(e){ roadFail(box,e); return; }
  box.innerHTML=html; box.hidden=false; document.body.classList.add('in-road');
  roadSafe(function(){ wireRoadStories(box); });
  roadSafe(function(){ wireRoadTips(box); });
  roadSafe(renderAdminBtn);
  roadSafe(function(){ if(typeof wireIdleBanner==='function') wireIdleBanner(); });
}
/* 로그인·로그아웃으로 계정이 바뀔 때 다시 읽는다 (hub-auth.js 가 refreshAccess 에서 refreshToday 를 부를 때 같이) */
if(typeof me!=='undefined'&&me) loadRoadData(); else renderRoad();

/* 심화상담 신청 화면: 지금 저장돼 있어서 상담을 보낼 때 고를 수 있는 내 기록. 읽기만 하며, 동의 문구는 건드리지 않는다 */
async function loadApplyRecs(){
  var box=document.getElementById('apply-recs'); if(!box||!sb||!me) return;
  var uid=me.id, row=function(label,v){ return '<li style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--line)"><span>'+label+'</span><b>'+v+'</b></li>'; };
  var core=0,walk=0,tests=0;
  try{ core=(await loadBirthCandidates()).length?1:0; }catch(e){}
  try{ var w=await sb.from('journey_answers').select('year',{count:'exact',head:true}).eq('user_id',uid); walk=w.count||0; }catch(e){}
  try{
    var q=await sb.from('profiles').select('profile,prefs,ipc').eq('id',uid).maybeSingle(), p=q.data||{};
    tests=(Array.isArray(p.profile)&&p.profile.some(Boolean)?1:0)+(Array.isArray(p.ipc)&&p.ipc.some(Boolean)?1:0)+(p.prefs&&typeof p.prefs==='object'&&Object.keys(p.prefs).length?1:0);
  }catch(e){}
  box=document.getElementById('apply-recs'); if(!box||!me||me.id!==uid) return;
  box.innerHTML='<div class="consent" style="margin:0 0 10px"><b>상담을 보낼 때 고를 수 있는 내 기록</b>'
    +'<ul style="list-style:none;margin:6px 0 0;padding:0;font-size:.85rem">'+row('사주·출생 정보',core?'있음':'없음')+row('인생 다시 걷기 기록',walk+'곳')+row('성향·기호·대인 검사',tests+'종')+'</ul>'
    +'<p style="margin:6px 0 0">보내기 직전에 항목마다 직접 골라요. 고르지 않은 것은 전달되지 않아요.</p></div>';
}

/* 앱에서 브라우저 '뒤로'로 돌아오면 브라우저가 예전에 본 허브 화면을 그대로 되살리는 일이 있다 — 그럴 땐 새로 불러와 항상 지금의 지도 허브로 보이게 한다 */
window.addEventListener('pageshow',function(e){ if(e.persisted) location.reload(); });
