/* 허브 첫 화면 '나만의 길' 그림 (시안 A-2). hub-road.js 가 불러 쓴다.
 * 세부 조율은 이 파일 위쪽 값만 고치면 된다:
 *   ROAD_MAIN / ROAD_BRANCH : 길과 곁가지의 곡선(SVG 경로, 화면 360x720 기준)
 *   ROAD_STORY             : 선 위 '글' 점의 위치(%)와 말풍선 문구·위치
 * 노드 위치·색·글자 자리는 roadArtHtml() 안의 N(...) 줄. 색은 오행색(var(--wood) 등). */
var ROAD_MAIN='M100 50 C150 60 215 95 210 160 C205 225 135 230 130 290 C125 350 215 355 220 420 C225 485 190 500 185 545 C180 595 170 615 160 640';
var ROAD_BRANCH=['M210 160 C255 150 295 140 300 105','M220 420 C262 428 295 445 298 482','M185 545 C150 542 115 546 85 558'];
/* x·y = 점 위치(% of 그림), bx·by = 말풍선 왼쪽·위(%). 문구는 예시 — 정해 주시는 대로 바꾼다 */
var ROAD_STORY=[
  {x:47.2,y:11.8,bx:40,by:15,t:'팔자를 통해 나온 데이터를 숫자로 치환하고, 이를 기반으로 여러 가지 정보를 얻어옵니다.'},
  {x:47.2,y:31.3,bx:44,by:35,t:'그런데 내담자가 어떤 삶을 살아왔는지는, 기계가 해석하지 못하는 정보예요.'},
  {x:48.6,y:49.3,bx:6,by:53,t:'로봇이 읽어 주는 텍스트 말고, 내가 하나씩 나를 돌아보는 시간이 되었으면 해요.'},
  {x:56.9,y:67.4,bx:6,by:60,t:'달력은 참고용이에요. 내 하루를 적어 두면 달력이 얼마나 맞았는지도 볼 수 있어요.'},
  {x:48.6,y:82.6,bx:44,by:70,t:'이 결과만으로 인생을 재단하지 않았으면 해요. 상담사와 이야기해 보세요.'}
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
function roadTxt(x,y,label,sub,small){
  return '<text class="rd-lbl" x="'+x+'" y="'+y+'"'+(small?' font-size="14"':'')+'>'+label+'</text>'
    +(sub?'<text class="rd-sub" x="'+x+'" y="'+(y+15)+'">'+sub+'</text>':'');
}
function roadArtHtml(d){
  var A=ANALYSIS_URL, here=!d.loaded?'':!d.core?'core':!d.walk?'walk':'';
  var ck=d.today?'오늘 기록 완료 · '+d.today.score+'점':'오늘 하루는 어땠나요?';
  var gate=roadGateText();
  var s='';
  s+=roadNode({name:'사주 입력',href:A+'?go=saju',x:100,y:50,r:13,c:'var(--wood)',now:here==='core',
    text:roadTxt(122,45,'사주 입력',d.loaded?(d.core?'완료':'지금 입력하기'):'')});
  s+=roadNode({name:'인생 다시 걷기',href:BASE+'life-walk/',x:210,y:160,r:25,c:'var(--wood)',now:here==='walk',
    text:roadTxt(60,150,'인생 다시 걷기',d.walk?d.walk+'곳 기록 · 이어서 걷기':'5분 · 걷기 시작')});
  s+=roadNode({name:'함께 걷기',href:BASE+'life-walk/together.html',x:300,y:105,r:13,c:'var(--fire)',text:roadTxt(268,82,'함께 걷기','',1)});
  s+=roadNode({name:'나의 흐름',href:A+'?go=saju',x:130,y:290,r:22,c:'var(--earth)',text:roadTxt(162,286,'나의 흐름','분석 · 사주')});
  s+=roadNode({name:'나를 더 알아보기',href:A+'?go=trait',x:220,y:420,r:22,c:'var(--metal)',text:roadTxt(30,410,'나를 더 알아보기','성향 · 기호 · 대인관계')});
  s+=roadNode({name:'만남',href:BASE+'mating-app/',x:298,y:482,r:13,c:'var(--fire)',text:roadTxt(280,516,'만남','',1)});
  s+=roadNode({name:'운세 체크인 달력',href:BASE+'lotto-app/',x:85,y:558,r:17,c:'var(--earth)',text:roadTxt(20,596,'운세 체크인 달력',ck)});
  s+=roadNode({name:'심화 상담',href:BASE+'counsel-tool/',gate:1,x:160,y:640,r:26,c:'var(--water)',text:roadTxt(197,652,'심화 상담',gate)});
  var dots=ROAD_STORY.map(function(p,i){
    return '<button class="rd-st" type="button" style="left:'+p.x+'%;top:'+p.y+'%" aria-expanded="false" aria-controls="rd-b'+i+'" data-i="'+i+'" aria-label="자림 이야기 '+(i+1)+'">글</button>';
  }).join('');
  var bubs=ROAD_STORY.map(function(p,i){
    return '<div class="rd-bub" id="rd-b'+i+'" hidden data-bx="'+p.bx+'" data-by="'+p.by+'" role="note">'+esc(p.t)+'<small>자림 이야기 '+(i+1)+'</small></div>';
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
    e.stopPropagation();
    var box2=art.querySelector('#rd-b'+b.dataset.i), open=box2.hidden; closeAll();
    if(!open) return;
    box2.hidden=false; b.setAttribute('aria-expanded','true');
    var W=art.clientWidth, H=art.clientHeight, w=box2.offsetWidth, h=box2.offsetHeight;
    var l=Math.max(0,Math.min(W-w,W*box2.dataset.bx/100)), t=Math.max(0,Math.min(H-h,H*box2.dataset.by/100));
    box2.style.left=l+'px'; box2.style.top=t+'px';
  }; });
  art.onclick=function(e){ if(!e.target.closest('.rd-bub,.rd-n')) closeAll(); };
  if(!wireRoadStories._k){ wireRoadStories._k=1; document.addEventListener('keydown',function(){ var e=arguments[0]; if(e.key==='Escape') document.querySelectorAll('.rd-bub').forEach(function(b){b.hidden=true}); }); }
}
