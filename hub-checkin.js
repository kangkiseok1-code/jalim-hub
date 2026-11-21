/* 허브 오늘 띠의 '오늘 하루는 어떤가요?' — 기운 체크인 앱과 같은 기록(daily_checkins, 본인만)에 오늘 기분을 남긴다.
   띠 오른쪽: 기록 전 [기록하기] → 아래에서 시트가 올라옴 / 기록 뒤 고른 알거북 아이콘(누르면 다시 고침).
   기분 값·이름표는 checkin/checkin-core.js 와 같게, 칩과 점수(1~10)는 운세 체크인 달력(lotto-app/balbok.js)과 같게 둔다 — 달력에서 '내 하루'로 바로 보이도록. */
var CK_MOODS=[{v:-2,l:'많이 힘듦'},{v:-1,l:'조금 힘듦'},{v:0,l:'보통'},{v:1,l:'괜찮음'},{v:2,l:'아주 좋음'}];
var CK_TAGS=['건강','돈','기분','사랑','일','쉼'];   // 달력 Balbok.TAGS 와 같은 이름
var CK_SCORE=[1,3,5,8,10];   // 기분 → 달력 점수 (Balbok.scoreFromMood 와 같음)
var CHECKIN_URL=ORIGIN+'/lotto-app/?day=today';   // 운세 체크인 달력의 오늘 일 페이지(방금 남긴 기록·반복점수)
var ckToday=null;   // 오늘 기록 {mood,tag,memo} 또는 null
function ckKey(){ var d=new Date(),p=function(n){return (n<10?'0':'')+n}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function ckMood(v){ return CK_MOODS.filter(function(m){return m.v===v})[0]||CK_MOODS[2]; }
async function loadCheckinToday(){
  ckToday=null; if(!sb||!me) return null;
  try{ var r=await sb.from('daily_checkins').select('mood,score,tag,memo').eq('user_id',me.id).eq('day',ckKey()).maybeSingle(); ckToday=r.error?null:r.data; }catch(e){ ckToday=null; }
  return ckToday;
}
/* 띠 아래 줄(기록 전에는 질문, 뒤에는 결과)과 오른쪽 버튼 */
function ckLine(){
  if(!ckToday) return '오늘 기분은 어떤가요?';
  return '오늘 '+ckMood(ckToday.mood).l+(ckToday.tag?' · '+esc(ckToday.tag):'')+(ckToday.memo?' · “'+esc(ckToday.memo)+'”':'');
}
function ckButton(){
  return ckToday?'<button type="button" class="ts-res" id="ts-act" aria-label="오늘 기록 고치기 ('+ckMood(ckToday.mood).l+')">'+TURTLE[ckToday.mood+2]+'</button>'
    :'<button type="button" class="ts-go" id="ts-act"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>기분 기록</button>';
}
function wireCheckin(){ var b=document.getElementById('ts-act'); if(b) b.onclick=ckSheet; }
function ckRefreshStrip(){
  var line=document.getElementById('ts-line'), b=document.getElementById('ts-act');
  if(line) line.innerHTML=ckLine();
  if(b){ b.outerHTML=ckButton(); wireCheckin(); }
}
function ckSheet(){
  var d={mood:ckToday?ckToday.mood:null, tag:ckToday?ckToday.tag:null};
  openSheet('<h3 class="ts-h">오늘 하루는 어떤가요?</h3>'
    +'<div class="ts-moods" role="group" aria-label="기분">'+CK_MOODS.map(function(m){
      return '<button type="button" class="ts-mood" data-v="'+m.v+'" aria-pressed="'+(d.mood===m.v)+'">'+TURTLE[m.v+2]+'<span>'+m.l+'</span></button>'; }).join('')+'</div>'
    +'<div class="ts-chips" role="group" aria-label="무슨 일이었나요(선택)">'+CK_TAGS.map(function(t){
      return '<button type="button" class="ts-chip" data-t="'+t+'" aria-pressed="'+(d.tag===t)+'">'+t+'</button>'; }).join('')+'</div>'
    +'<input class="ts-memo" id="ts-memo" maxlength="40" placeholder="한 줄 메모 (선택, 40자)" value="'+esc(ckToday&&ckToday.memo||'')+'">'
    +'<button type="button" class="btn ts-save" id="ts-save"'+(d.mood==null?' disabled':'')+'>저장</button>'
    +'<a class="ts-more" href="'+CHECKIN_URL+'">운세 달력에서 보기 ›</a>');
  var root=sheetEl, save=root.querySelector('#ts-save');
  root.querySelectorAll('.ts-mood').forEach(function(b){ b.onclick=function(){
    d.mood=+b.dataset.v; root.querySelectorAll('.ts-mood').forEach(function(o){o.setAttribute('aria-pressed',String(o===b))}); save.disabled=false; }; });
  root.querySelectorAll('.ts-chip').forEach(function(b){ b.onclick=function(){
    d.tag=d.tag===b.dataset.t?null:b.dataset.t; root.querySelectorAll('.ts-chip').forEach(function(o){o.setAttribute('aria-pressed',String(o.dataset.t===d.tag))}); }; });
  save.onclick=async function(){
    if(d.mood==null||!sb||!me) return;
    var memo=root.querySelector('#ts-memo').value.trim().slice(0,40)||null;
    save.disabled=true; save.textContent='저장 중…';
    var score=ckToday&&ckToday.mood===d.mood&&ckToday.score?ckToday.score:CK_SCORE[d.mood+2];   // 달력에서 고른 점수는 기분이 같으면 그대로 둔다
    var r=await sb.from('daily_checkins').upsert({user_id:me.id,day:ckKey(),mood:d.mood,score:score,tag:d.tag||null,memo:memo},{onConflict:'user_id,day'});
    if(r.error){ save.disabled=false; save.textContent='저장'; toast('저장하지 못했어요. 다시 눌러 주세요'); return; }
    ckToday={mood:d.mood,score:score,tag:d.tag||null,memo:memo}; closeSheet(); ckRefreshStrip(); toast('오늘 하루를 기록했어요');
  };
}
