/* 허브 첫 화면 '나만의 길' 그림 — 통일 톤(파스텔 오행 면 + 지그재그 길). hub-road.js 가 불러 쓴다.
 * 세부 조율은 이 파일 위쪽 값만 고치면 된다:
 *   ROAD_MAIN / ROAD_BRANCH : 길과 곁가지(SVG 경로, 그림 330x600 기준)
 *   ROAD_NODES              : 노드 위치·크기·오행·모양·아이콘
 *   ROAD_STORY              : 선 위 '글' 점의 자리와 말풍선 문구
 * 색은 jalim-base.css 의 토큰(--wood-soft 등)만 쓴다 — 여기에 색 값을 직접 쓰지 않는다. */
var ROAD_W=330, ROAD_H=600;
var ROAD_MAIN=['M92 70 H205 Q245 70 245 112 V150','M245 150 V190 Q245 240 200 240 H92','M92 240 C92 300 170 290 170 350','M170 350 H130 Q80 350 80 400 V440','M80 440 V470 Q80 520 130 520 H208'];
var ROAD_BRANCH=['M245 150 H138','M170 350 L262 318','M170 350 L266 392'];
/* key, 이름(줄바꿈은 |), x, y, r, 오행, 모양(solid|ring), 아이콘, 글자 크기 */
var ROAD_NODES=[
 ['core','사주|입력',92,70,42,'wood','solid','compass',13],
 ['walk','인생|다시 걷기',245,150,46,'fire','ring','foot',13],
 ['together','함께|걷기',125,150,33,'fire','solid','two',11.5],
 ['flow','나의|흐름',92,240,42,'earth','solid','wave',13],
 ['more','나를 더|알아보기',170,350,46,'metal','ring','search',13],
 ['peer','지인이|본 나',272,316,30,'metal','solid','people',11],
 ['mate','만남',276,396,30,'metal','solid','rings',12],
 ['check','운세 체크인|달력',80,440,42,'water','solid','cal',11.5],
 ['counsel','심화|상담',224,520,46,'water','solid','chat',13]];
var ROAD_ICON={compass:'<circle cx="12" cy="12" r="8"/><path d="M15 9l-2 5-4 1 2-5z"/>',foot:'<ellipse cx="9" cy="8" rx="2.4" ry="3.6"/><ellipse cx="15.5" cy="14" rx="2.4" ry="3.6"/>',
 two:'<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3.5 19c.6-3.4 2.4-5 4.5-5s3.9 1.6 4.5 5M11.5 19c.6-3.4 2.4-5 4.5-5s3.9 1.6 4.5 5"/>',
 wave:'<path d="M3 9c3-4 6 4 9 0s6 4 9 0M3 15c3-4 6 4 9 0s6 4 9 0"/>',search:'<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
 people:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.8-3.6 3-5.4 6-5.4s5.2 1.8 6 5.4"/>',rings:'<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
 cal:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/>',chat:'<path d="M5 6h14v10h-8l-4 4v-4H5z"/>'};
/* 이야기 점: x·y = 길 위 점의 자리(그림 330x600 기준), pos = 글자 자리(a 위 · r 오른쪽), open:'story' = 허브의 자림 스토리텔링 읽기 화면.
 * 문구는 앱 첫 화면의 글을 그대로 옮김 — 바꿀 때는 여기만 고친다(\n = 줄바꿈) */
var ROAD_STORY=[
  {x:186,y:70,pos:'a',title:'자림 스토리텔링',open:'story'},
  {x:188,y:240,pos:'b',title:'명리치유 첫 화면',t:'사주 명리학은 길흉을 점치는 도구도, 흥망을 알아맞히는 퀴즈도 아닙니다.\n내가 어떤 사람인지 또렷이 비추어, 그에 맞는 삶을 설계하도록 돕는 나침반이라 믿습니다.\n내가 아는 나와 남이 보는 나를 마주 세워, 더 깊이 나를 들여다보는 귀한 순간이 되기를.\n— 명리치유사 자림'},
  {x:132,y:290,pos:'r',title:'만남 글귀',t:'운명이 찾아오기만을 기다리고 있나요?\n옷깃이 스칠 일조차 드문 시대, 이제 인연은 내가 먼저 알아보는 것입니다.\n명리로 나를 비추고, 성향을 더하고, 나의 데이터를 입혔습니다.\n내가 아는 나와 남이 보는 나를 지나 나에게 맞는 사람에게로.\n— 자림과 함께합니다'},
  {x:142,y:520,pos:'b',title:'체크인 달력',t:'일확천금을 약속드릴 수는 없지만, 행복을 스스로 찾아가듯 행운도 내게 오도록 길을 낼 수는 있습니다.\n명리학으로 읽은 나의 사주로 재물이 좋은 날과 복이 드는 시기를 짚고, 내게 필요한 기운의 숫자를 골라 드립니다.\n여러 패턴과 데이터를 더해 행운을 붙잡는 작은 보탬과 소소한 즐거움이 되고자 합니다.'}
];
var ROAD_LINK={core:function(A){return A+'?go=saju'},walk:function(A,B){return B+'life-walk/'},together:function(A,B){return B+'life-walk/together.html'},
 flow:function(A){return A+'?go=saju'},more:function(A){return A+'?go=trait'},peer:function(A){return A+'?go=peer'},mate:function(A,B){return B+'mating-app/'},
 check:function(A,B){return B+'lotto-app/'},counsel:function(A,B){return B+'counsel-tool/'}};

function roadGateText(){
  if(!me||!access||!access.loaded) return '';
  if(access.admin) { var n=pendingCount(); return n?'신청 '+n+'건':''; }
  var s=access.counsel;
  return s==='pending'?'승인 대기':s==='rejected'?'승인 안 됨':s!=='approved'?'신청 필요':'';
}
/* 노드 한 개: 파스텔 원(또는 고리) + 아이콘 + 이름. 글자색은 오행별 -ink 토큰 */
function roadNode(n,d,here){
  var key=n[0],name=n[1].split('|'),x=n[2],y=n[3],r=n[4],el=n[5],ring=n[6]==='ring',fs=n[8];
  var soft='var(--'+el+'-soft)', ink=ring?(el==='fire'?'var(--fire-deep)':'var(--metal-ink)'):'var(--'+el+'-ink)';
  var fill=ring?(el==='fire'?'var(--fire-tint)':'var(--metal-tint)'):soft;
  var href=ROAD_LINK[key](ANALYSIS_URL,BASE), gate=key==='counsel'?' data-gate="counsel"':'';
  var s='<a href="'+href+'" class="rd-n" aria-label="'+esc(name.join(' '))+'"'+gate+'>';
  if(here===key) s+='<circle cx="'+x+'" cy="'+y+'" r="'+(r+9)+'" class="rd-ring"/>';
  s+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" class="rd-dot" style="fill:'+fill+(ring?';stroke:'+soft+';stroke-width:6':'')+'"/>'
    +'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="url(#rd-hi)"/>'
    +'<g transform="translate('+(x-9)+' '+(y-r*.62-4)+') scale(.75)" class="rd-ic" style="stroke:'+ink+'">'+ROAD_ICON[n[7]]+'</g>';
  name.forEach(function(line,i){ s+='<text x="'+x+'" y="'+(y+3+i*(fs+3))+'" text-anchor="middle" class="rd-nm" font-size="'+fs+'" style="fill:'+ink+'">'+esc(line)+'</text>'; });
  var cap=key==='walk'&&d.walk?d.walk+'곳 기록':key==='check'?(d.today?'오늘 기록 완료 · '+d.today.score+'점':'오늘 하루는 어땠나요?'):key==='counsel'?roadGateText():key==='core'&&d.loaded&&!d.core?'지금 입력하기':'';
  if(cap) s+='<text x="'+x+'" y="'+(y+r+15)+'" text-anchor="middle" class="rd-cap">'+esc(cap)+'</text>';
  return s+'</a>';
}
function roadArtHtml(d){
  var here=!d.loaded?'':!d.core?'core':!d.walk?'walk':'';
  var svg='<svg viewBox="0 0 '+ROAD_W+' '+ROAD_H+'" aria-label="나의 길 지도"><defs>'
   +'<linearGradient id="rd-pg" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="0" y2="540"><stop offset="0" style="stop-color:var(--wood-soft)"/><stop offset=".26" style="stop-color:var(--fire-soft)"/><stop offset=".5" style="stop-color:var(--earth-soft)"/><stop offset=".72" style="stop-color:var(--metal-soft)"/><stop offset="1" style="stop-color:var(--water-soft)"/></linearGradient>'
   +'<radialGradient id="rd-hi" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
   +'<filter id="rd-soft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="6" style="flood-color:var(--shadow-ink)"/></filter></defs>'
   +'<g filter="url(#rd-soft)" fill="none" stroke="url(#rd-pg)" stroke-linecap="round">'
   +ROAD_MAIN.map(function(p,i){return '<path pathLength="1" class="rd-draw rd-d'+(i%3+1)+'" stroke-width="22" d="'+p+'"/>';}).join('')
   +ROAD_BRANCH.map(function(p){return '<path pathLength="1" class="rd-draw rd-d3" stroke-width="12" d="'+p+'"/>';}).join('')+'</g>'
   +'<g filter="url(#rd-soft)">'+ROAD_NODES.map(function(n){return roadNode(n,d,here)}).join('')+'</g></svg>';
  var dots=ROAD_STORY.map(function(p,i){
    return '<button class="rd-st" type="button" style="left:'+(p.x/ROAD_W*100).toFixed(1)+'%;top:'+(p.y/ROAD_H*100).toFixed(1)+'%" aria-expanded="false" data-i="'+i+'"'+(p.open?'':' aria-controls="rd-b'+i+'"')+'><i></i><span class="rd-t-'+p.pos+'">'+esc(p.title)+'</span></button>';
  }).join('');
  var bubs=ROAD_STORY.map(function(p,i){
    return p.open?'':'<div class="rd-bub" id="rd-b'+i+'" hidden role="note"><b>'+esc(p.title)+'</b>'+esc(p.t)+'</div>';
  }).join('');
  return '<div class="rd-art">'+svg+dots+bubs+'</div>';
}
/* '글' 점을 누르면 말풍선이 열리고, 다시 누르거나 다른 곳을 누르면 닫힌다. 그림 밖으로 나가지 않게 맞춘다 */
function wireRoadStories(box){
  var art=box.querySelector('.rd-art'); if(!art) return;
  var dots=art.querySelectorAll('.rd-st'), bubs=art.querySelectorAll('.rd-bub');
  function closeAll(){ bubs.forEach(function(b){b.hidden=true}); dots.forEach(function(x){x.setAttribute('aria-expanded','false')}); }
  dots.forEach(function(b){ b.onclick=function(e){
    e.stopPropagation(); var p=ROAD_STORY[+b.dataset.i];
    if(p.open==='story'){ closeAll(); var so=document.getElementById('story-open'); if(so) so.click(); return; }
    var box2=art.querySelector('#rd-b'+b.dataset.i), open=box2.hidden; closeAll();
    if(!open) return;
    box2.hidden=false; b.setAttribute('aria-expanded','true');
    var W=art.clientWidth, H=art.clientHeight, w=box2.offsetWidth, h=box2.offsetHeight, bx=b.offsetLeft, by=b.offsetTop+b.offsetHeight/2+10;
    if(by+h>H) by=b.offsetTop-h-4;   // 아래가 모자라면 점 위로
    box2.style.left=Math.max(0,Math.min(W-w,bx-8))+'px'; box2.style.top=Math.max(0,by)+'px';
  }; });
  art.onclick=function(e){ if(!e.target.closest('.rd-bub,.rd-n')) closeAll(); };
  if(!wireRoadStories._k){ wireRoadStories._k=1; document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.querySelectorAll('.rd-bub').forEach(function(b){b.hidden=true}); }); }
}
