/* 허브 첫 화면 '나만의 길' 그림 (시안 A-2). hub-road.js 가 불러 쓴다.
 * 세부 조율은 이 파일 위쪽 값만 고치면 된다:
 *   ROAD_MAIN / ROAD_BRANCH : 길과 곁가지의 곡선(SVG 경로, 화면 360x720 기준)
 *   ROAD_STORY             : 선 위 '글' 점의 위치(%)와 말풍선 문구·위치
 * 노드 위치·색·글자 자리는 roadArtHtml() 안의 N(...) 줄. 색은 오행색(var(--wood) 등). */
var ROAD_MAIN='M100 50 C150 60 215 95 210 160 C205 225 135 230 130 290 C125 350 215 355 220 420 C225 485 190 500 185 545 C180 595 170 615 160 640';
var ROAD_BRANCH=['M210 160 C262 152 305 150 324 122','M220 420 C262 428 295 445 298 482','M185 545 C150 542 115 546 85 558','M236 408 C248 404 257 398 266 392'];
/* 이야기 점: x·y = 길 위 점의 자리(그림 360x720 기준), title = 점 옆에 보이는 이름, open:'story' = 허브의 자림 스토리텔링 읽기 화면을 연다, t = 말풍선 문구(
 = 줄바꿈).
 * 위치는 그림판에서 그려 주신 자리. 문구는 앱 첫 화면의 글을 그대로 옮겼다 — 바꿀 때는 여기만 고친다 */
var ROAD_STORY=[
  {x:186,y:92,title:'자림 스토리텔링',open:'story'},
  {x:170,y:226,title:'명리치유 첫 화면',t:'사주 명리학은 길흉을 점치는 도구도, 흥망을 알아맞히는 퀴즈도 아닙니다.\n내가 어떤 사람인지 또렷이 비추어, 그에 맞는 삶을 설계하도록 돕는 나침반이라 믿습니다.\n내가 아는 나와 남이 보는 나를 마주 세워, 더 깊이 나를 들여다보는 귀한 순간이 되기를.\n— 명리치유사 자림'},
  {x:171,y:355,title:'만남 글귀',t:'운명이 찾아오기만을 기다리고 있나요?\n옷깃이 스칠 일조차 드문 시대, 이제 인연은 내가 먼저 알아보는 것입니다.\n명리로 나를 비추고, 성향을 더하고, 나의 데이터를 입혔습니다.\n내가 아는 나와 남이 보는 나를 지나 나에게 맞는 사람에게로.\n— 자림과 함께합니다'},
  {x:201,y:500,title:'체크인 달력',t:'일확천금을 약속드릴 수는 없지만, 행복을 스스로 찾아가듯 행운도 내게 오도록 길을 낼 수는 있습니다.\n명리학으로 읽은 나의 사주로 재물이 좋은 날과 복이 드는 시기를 짚고, 내게 필요한 기운의 숫자를 골라 드립니다.\n여러 패턴과 데이터를 더해 행운을 붙잡는 작은 보탬과 소소한 즐거움이 되고자 합니다.'}
];

function roadGateText(){
  if(!me||!access||!access.loaded) return '';
  if(access.admin) { var n=pendingCount(); return n?'신청 '+n+'건':''; }
  var s=access.counsel;
  return s==='pending'?'승인 대기':s==='rejected'?'승인 안 됨':s!=='approved'?'신청 필요':'';
}
/* 노드 한 개: 색 원 + (선택) 지금 표시 고리 + 글자. link 는 SVG <a> */
function roadNode(o){
  var ring=o.now?'<circle cx="'+o.x+'" cy="'+o.y+'" r="'+(o.r+7)+'" class="rd-ring"/>':'';
  var attr=o.gate?' data-gate="counsel"':'';
  return '<a href="'+o.href+'" class="rd-n"'+attr+' aria-label="'+esc(o.name)+'">'+ring
    +'<circle cx="'+o.x+'" cy="'+o.y+'" r="'+o.r+'" style="fill:'+o.c+'" class="rd-dot"/>'
    +o.text+'</a>';
}
function roadTxt(x,y,label,sub,small,anchor){   // anchor: 'end'(노드 왼쪽에 붙임) | 'middle'(노드 아래) | 생략=오른쪽
  var a=anchor?' text-anchor="'+anchor+'"':'';
  return '<text class="rd-lbl" x="'+x+'" y="'+y+'"'+a+(small?' font-size="'+(small===2?12:14)+'"':'')+'>'+label+'</text>'
    +(sub?'<text class="rd-sub" x="'+x+'" y="'+(y+15)+'"'+a+'>'+sub+'</text>':'');
}
function roadArtHtml(d){
  var A=ANALYSIS_URL, here=!d.loaded?'':!d.core?'core':!d.walk?'walk':'';
  var ck=d.today?'오늘 기록 완료 · '+d.today.score+'점':'오늘 하루는 어땠나요?';
  var gate=roadGateText();
  var s='';
  s+=roadNode({name:'사주 입력',href:A+'?go=saju',x:100,y:50,r:13,c:'var(--wood)',now:here==='core',
    text:roadTxt(122,45,'사주 입력',d.loaded?(d.core?'완료':'지금 입력하기'):'')});
  s+=roadNode({name:'인생 다시 걷기',href:BASE+'life-walk/',x:210,y:160,r:25,c:'var(--wood)',now:here==='walk',
    text:roadTxt(177,155,'인생 다시 걷기',d.walk?d.walk+'곳 기록':'5분 · 걷기 시작',0,'end')});
  s+=roadNode({name:'함께 걷기',href:BASE+'life-walk/together.html',x:324,y:122,r:13,c:'var(--fire)',text:roadTxt(324,152,'함께 걷기','',1,'middle')});
  s+=roadNode({name:'나의 흐름',href:A+'?go=saju',x:130,y:290,r:22,c:'var(--earth)',text:roadTxt(160,286,'나의 흐름','분석 · 사주')});
  s+=roadNode({name:'나를 더 알아보기',href:A+'?go=trait',x:220,y:420,r:22,c:'var(--metal)',text:roadTxt(190,415,'나를 더 알아보기','성향 · 기호 · 대인관계',0,'end')});
  s+=roadNode({name:'지인이 본 나',href:A+'?go=peer',x:266,y:392,r:8,c:'var(--wood)',text:roadTxt(277,397,'지인이 본 나','',2)});
  s+=roadNode({name:'만남',href:BASE+'mating-app/',x:298,y:482,r:13,c:'var(--fire)',text:roadTxt(314,487,'만남','',1)});
  s+=roadNode({name:'운세 체크인 달력',href:BASE+'lotto-app/',x:85,y:558,r:17,c:'var(--earth)',text:roadTxt(85,592,'운세 체크인 달력',ck,0,'middle')});
  s+=roadNode({name:'심화 상담',href:BASE+'counsel-tool/',gate:1,x:160,y:640,r:26,c:'var(--water)',text:roadTxt(194,646,'심화 상담',gate)});
  var dots=ROAD_STORY.map(function(p,i){
    return '<button class="rd-st" type="button" style="left:'+(p.x/3.6).toFixed(1)+'%;top:'+(p.y/7.2).toFixed(1)+'%" aria-expanded="false" data-i="'+i+'"'+(p.open?'':' aria-controls="rd-b'+i+'"')+'><i></i><span>'+esc(p.title)+'</span></button>';
  }).join('');
  var bubs=ROAD_STORY.map(function(p,i){
    return p.open?'':'<div class="rd-bub" id="rd-b'+i+'" hidden role="note"><b>'+esc(p.title)+'</b>'+esc(p.t)+'</div>';
  }).join('');
  return '<div class="rd-art"><svg viewBox="0 0 360 720" aria-label="나의 길 지도">'
    +'<defs><filter id="rd-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2"/></filter></defs>'
    +'<g filter="url(#rd-rough)"><path pathLength="1" class="rd-line rd-draw" stroke-width="9" opacity=".08" d="'+ROAD_MAIN+'"/>'
    +'<path pathLength="1" class="rd-line rd-draw" stroke-width="2.6" d="'+ROAD_MAIN+'"/>'
    +ROAD_BRANCH.map(function(b,i){return '<path pathLength="1" class="rd-line rd-draw rd-d'+(i%2?3:2)+'" stroke-width="2" d="'+b+'"/>';}).join('')
    +'</g>'+s+'</svg>'+dots+bubs+'</div>';
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
  if(!wireRoadStories._k){ wireRoadStories._k=1; document.addEventListener('keydown',function(){ var e=arguments[0]; if(e.key==='Escape') document.querySelectorAll('.rd-bub').forEach(function(b){b.hidden=true}); }); }
}
