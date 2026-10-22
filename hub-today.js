/* 허브 '오늘의 기운' 카드 — 만남 프로필의 생년월일 + 만남 앱과 같은 사주 엔진.
   엔진(약 1MB)은 허브를 연 뒤 로그인한 사람에게만 늦게 불러온다(만남을 한 번이라도 열었다면 브라우저에 이미 있다). */
var TODAY_ENGINE_URL=ORIGIN+'/mating-app/engine.browser.js';
var todayEngine=null, todayRun=0;
function loadTodayEngine(){
  if(window.OhaengEngine) return Promise.resolve(window.OhaengEngine);
  if(todayEngine) return todayEngine;
  todayEngine=new Promise(function(ok,fail){
    var s=document.createElement('script'); s.src=TODAY_ENGINE_URL;
    s.onload=function(){ window.OhaengEngine?ok(window.OhaengEngine):fail(new Error('engine')) };
    s.onerror=function(){ todayEngine=null; fail(new Error('engine load')) };
    document.head.appendChild(s);
  });
  return todayEngine;
}
/* 만남 앱의 오늘 문구와 같은 내용 (십성 묶음별) */
var TODAY_GROUP={비견:'비겁',겁재:'비겁',식신:'식상',상관:'식상',편재:'재성',정재:'재성',편관:'관성',정관:'관성',편인:'인성',정인:'인성'};
var TODAY_BY_GROUP={
  비겁:{t:'나다운 날', line:'결이 같은 기운이라 자신감이 붙는 날. 나답게 움직여도 좋아요.'},
  식상:{t:'표현의 날', line:'말과 표현이 잘 통하는 날. 먼저 연락하면 좋은 흐름이에요.'},
  재성:{t:'결실의 날', line:'차분히 챙기면 실속이 따르는 날. 계획을 다듬기 좋아요.'},
  관성:{t:'다잡는 날', line:'긴장이 있는 날. 무리하지 말고 나만의 페이스를 지켜보세요.'},
  인성:{t:'채우는 날', line:'기운을 채워주는 날. 배우고 쉬어가기 좋은 하루예요.'}
};
var TODAY_ELEM={목:{h:'木',c:'var(--wood)',k:'초록빛'},화:{h:'火',c:'var(--fire)',k:'붉은빛'},토:{h:'土',c:'var(--earth)',k:'노란빛'},금:{h:'金',c:'var(--metal)',k:'흰빛'},수:{h:'水',c:'var(--water)',k:'검은빛'}};
function todayFortune(E,p){
  var hasHour=!p.time_unknown&&p.birth_h!=null;
  var s=E.saju.computeSaju(p.birth_y,p.birth_mo,p.birth_d,hasHour?p.birth_h:'',{minute:p.birth_min||0,calendar:p.calendar||'solar',leap:!!p.leap,city:p.birth_city||undefined});
  var toGan=function(g){return typeof g==='number'?E.saju.GAN[g]:g};
  var dmRaw=s.pillars&&s.pillars.day&&s.pillars.day.gan; if(dmRaw==null) return null;
  var dm=toGan(dmRaw), now=new Date();
  var t=E.transit.transitPillars(now.getFullYear(),now.getMonth()+1,now.getDate());
  var todayGan=toGan(t.day.gan);
  var idx=(t.day.ganIdx!=null)?t.day.ganIdx:E.saju.GAN.indexOf(todayGan);
  var elem=E.saju.GAN_ELEM[idx]; if(!elem||!TODAY_ELEM[elem]) return null;
  var dmIdx=typeof dmRaw==='number'?dmRaw:E.saju.GAN.indexOf(dmRaw), sib=null;   // sibsinOf는 천간 번호(0~9)를 받는다 — 글자를 넘기면 늘 '비견'이 나온다
  try{ sib=E.saju.sibsinOf(dmIdx,idx) }catch(e){}
  var d=TODAY_BY_GROUP[TODAY_GROUP[sib]||'비겁'];
  return {elem:elem,title:d.t,line:d.line,date:(now.getMonth()+1)+'월 '+now.getDate()+'일 · '+'일월화수목금토'.charAt(now.getDay())+'요일'};
}
var MATING_URL=ORIGIN+'/mating-app/';
function todayCardHtml(f,nick){
  var e=TODAY_ELEM[f.elem];
  return '<a class="today-in jm-press" href="'+MATING_URL+'?go=saju" aria-label="내 사주 분석 보기">'
    +'<div class="today-mark" style="background:'+e.c+'" aria-hidden="true">'+e.h+'</div>'
    +'<div class="today-txt"><span class="today-date">'+esc(f.date)+'</span>'
    +'<b>'+(nick?esc(nick)+'님, ':'')+'오늘은 '+e.h+'의 날이에요</b>'
    +'<span class="today-line">'+esc(f.title)+' · '+esc(f.line)+'</span>'
    +'<span class="today-lucky">행운색 '+e.k+'</span></div></a>';
}
/* 나의 분석 바로가기 — 검사했는지는 허브가 모른다. 눌러서 만남의 그 탭으로 가면 거기서 결과 또는 '검사하기'가 나온다 */
var MY_TILES=[
  ['trait','성향','<path d="M12 3l8 6-3 10H7L4 9z"/>'],
  ['pref','기호','<path d="M5 7h14M5 12h14M5 17h9"/>'],
  ['ipc','대인관계','<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>']];
function renderMyTiles(){
  var box=document.getElementById('mytiles'); if(!box) return;
  if(!me){ box.hidden=true; box.innerHTML=''; return; }
  box.hidden=false;
  box.innerHTML='<div class="sec-label">나의 분석</div><div class="mytile-row">'+MY_TILES.map(function(x){
    return '<a class="mytile jm-press" href="'+MATING_URL+'?go='+x[0]+'"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+x[2]+'</svg>'+x[1]+'</a>';
  }).join('')+'</div>';
}
/* 로그인한 사람의 프로필을 읽어 카드를 그린다. 로그인 전·생년월일 없음·불러오기 실패는 카드 없이(지금 모습 그대로) */
async function refreshToday(){
  var box=document.getElementById('today'); if(!box) return;
  var run=++todayRun;
  renderMyTiles();
  box.hidden=true; box.innerHTML='';
  if(!sb||!me) return;
  try{
    var q=await sb.from('profiles').select('nickname,calendar,leap,birth_y,birth_mo,birth_d,birth_h,birth_min,birth_city,time_unknown').eq('id',me.id).maybeSingle();
    var p=q.data; if(run!==todayRun||!p||!p.birth_y||!p.birth_mo||!p.birth_d) return;
    box.hidden=false; box.className='today jn-skel'; box.setAttribute('aria-busy','true');   // 엔진을 받는 동안 자리만 잡아 둔다
    var E=await loadTodayEngine(); if(run!==todayRun) return;
    var f=todayFortune(E,p); if(run!==todayRun) return;
    if(!f){ box.hidden=true; box.className=''; return; }
    box.className='today jm-rise'; box.removeAttribute('aria-busy'); box.innerHTML=todayCardHtml(f,p.nickname);
  }catch(e){ if(run===todayRun){ box.hidden=true; box.className=''; box.innerHTML=''; } }
}
/* hub-auth.js 가 로그인 확인을 이 파일보다 먼저 끝내는 경우(저장된 로그인은 바로 확인돼 이 파일이 내려받아지기 전에 끝남)를 위해,
   이 파일이 준비된 시점에 이미 로그인돼 있으면 한 번 그린다. (아직 확인 전이면 hub-auth.js 가 계정을 확인한 뒤 알아서 부른다) */
if(typeof me!=='undefined'&&me) refreshToday();
