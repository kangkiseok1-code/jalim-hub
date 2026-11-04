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

function roadAdmin(){
  if(!access||!access.admin||!access.loaded) return '';
  var n=pendingCount();
  return '<div class="road-admin"><h3>관리자 전용 <span class="jn-chip">관리자 모드</span></h3><div class="rows">'
    +'<button class="row" id="road-adm" type="button"><span>심화상담 승인 대기</span><b>'+n+'</b></button></div></div>';
}
function roadMore(){
  var h='';
  if(access&&access.admin&&access.loaded) h+='<a href="'+BASE+'Team-maker/team-maker.html">팀메이커 <small>관리자 전용</small></a>';
  return h?'<div class="road-more">'+h+'</div>':'';
}
function renderRoad(){
  var box=document.getElementById('road'); if(!box) return;
  if(!me){ box.hidden=true; box.innerHTML=''; document.body.classList.remove('in-road'); return; }
  try{
    var d=roadData.uid===me.id?roadData:{core:false,walk:0,checkins:0,today:null,recent:[false,false,false,false,false],nick:''};
    box.innerHTML=(typeof idleBannerHtml==='function'?idleBannerHtml():'')+'<h2 class="road-h">'+(d.nick?esc(d.nick)+'님, ':'')+'오늘은 여기까지 와 있어요</h2>'
      +roadAdmin()+roadArtHtml(d)+roadMore();
    box.hidden=false; document.body.classList.add('in-road');
    var adm=document.getElementById('road-adm'); if(adm) adm.onclick=adminSheet;
    wireRoadStories(box);
    if(typeof wireIdleBanner==='function') wireIdleBanner();
  }catch(e){ box.hidden=true; box.innerHTML=''; document.body.classList.remove('in-road'); }   // 문제가 생기면 지금까지의 허브 모습으로
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
