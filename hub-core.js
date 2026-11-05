/* hub-core.js — 첫 로그인 뒤 "내 출생정보를 모든 자림 앱에서 쓸까요?" 동의 한 번.
 *  - 이미 입력해 둔 정보(만남·분석 프로필)가 있으면: 요약을 보여 주고 동의 한 번으로 공용 출생정보(core_profiles)에 옮긴다.
 *  - 아무 정보도 없으면: 여기서 생년월일을 입력하고 동의하면 공용 출생정보와 프로필에 함께 저장한다.
 *  체크인 달력·인생 다시 걷기·심화상담은 공용 출생정보를 읽어 입력칸을 채운다.
 *  쓰는 전역(hub-auth.js · birth-check.js): me, sb, access, sheetEl, openSheet, closeSheet, esc, toast, status, $, BirthCheck, MANAGE, APPLY, NEXT */
var CORE_VER_HUB='v1', coreAsked=false, coreTries=0;
var CORE_P_COLS='nickname,gender,calendar,leap,birth_y,birth_mo,birth_d,birth_h,birth_min,time_unknown,birth_city';
var CORE_LATER_MS=3*24*3600*1000;   // "나중에"를 누르면 3일 뒤에 다시 물어본다

/* 프로필/입력값 → core_profiles 한 줄 */
function coreRowFrom(uid,p){
  var unk=!!p.time_unknown||p.birth_h==null;
  return { user_id:uid, nickname:String(p.nickname||'').trim().slice(0,20)||null,
    gender:p.gender==='male'||p.gender==='female'?p.gender:null,
    calendar:p.calendar==='lunar'?'lunar':'solar', leap:p.calendar==='lunar'&&!!p.leap,
    birth_y:p.birth_y, birth_mo:p.birth_mo, birth_d:p.birth_d,
    birth_h:unk?null:p.birth_h, birth_min:unk?null:(p.birth_min||0), time_unknown:unk,
    birth_city:p.birth_city||null, consent_version:CORE_VER_HUB, consent_at:new Date().toISOString() };
}
function coreBirthLine(p){
  return p.birth_y+'년 '+p.birth_mo+'월 '+p.birth_d+'일'+((p.time_unknown||p.birth_h==null)?'':' · '+p.birth_h+'시'+(p.birth_min?' '+p.birth_min+'분':''))+(p.calendar==='lunar'?' (음력)':'');
}
function coreLaterKey(uid){ return 'jalim_core_later_'+uid; }
function coreLaterNow(uid){ try{ var t=+localStorage.getItem(coreLaterKey(uid)); return t&&Date.now()-t<CORE_LATER_MS; }catch(e){ return false; } }
function coreLaterSet(uid){ try{ localStorage.setItem(coreLaterKey(uid),String(Date.now())); }catch(e){} }

var CORE_CONSENT_HTML='<label class="chk"><input type="checkbox" id="cb-ok"> 오늘의 기운·재물운·인생 다시 걷기·심화상담 등 다른 자림 앱에서 내 출생정보를 쓰는 데 동의해요</label>'
  +'<p class="sub" style="margin:6px 0 0;font-size:.78rem">동의는 언제든 이 화면의 내 계정에서 거둘 수 있어요. 태어난 시각과 곳은 사주의 정확도를 높이는 데만 써요.</p>';

async function checkCoreConsent(){
  if(coreAsked||!sb||!me||MANAGE||APPLY||NEXT) return;
  if(sheetEl){ if(coreTries++<6) setTimeout(checkCoreConsent,1500); return; }   // 로그인 완료 표시가 닫힌 뒤에 띄운다
  var uid=me.id;
  try{
    var c=await sb.from('core_profiles').select('user_id').eq('user_id',uid).maybeSingle();
    if(c.error||!me||me.id!==uid) return;
    if(c.data){ coreAsked=true; return; }
    if(coreLaterNow(uid)) return;
    var q=await sb.from('profiles').select(CORE_P_COLS).eq('id',uid).maybeSingle();
    if(q.error||!me||me.id!==uid||sheetEl) return;
    coreAsked=true;
    var p=q.data;
    if(p&&p.birth_y&&p.birth_mo&&p.birth_d) coreAdoptSheet(p); else coreFirstSheet();
  }catch(e){}
}
function coreSaved(){
  closeSheet(); toast('저장했어요. 다른 앱에도 자동으로 채워져요');
  if(typeof refreshToday==='function') refreshToday();
  if(typeof loadRoadData==='function') loadRoadData();
}
/* ① 이미 입력해 둔 정보가 있을 때 — 동의 한 번 */
function coreAdoptSheet(p){
  var uid=me.id;
  openSheet('<h2 style="margin-bottom:4px">입력해 둔 정보를 모든 앱에서 쓸까요?</h2>'
   +'<p class="sub" style="margin:0 0 10px">이미 입력하신 정보예요. 동의하면 앱마다 다시 입력하지 않아도 돼요.</p>'
   +'<div class="consent" style="margin:0 0 10px"><b>'+esc(p.nickname||'내 정보')+'</b><p>'+esc(coreBirthLine(p))+'</p></div>'
   +CORE_CONSENT_HTML
   +'<div id="st" class="status" role="status"></div>'
   +'<button class="btn" id="cb-go" type="button" style="width:100%;margin-top:6px" disabled>동의하고 쓰기</button>'
   +'<p class="sub" style="text-align:center;margin:12px 0 0"><span class="switch" id="cb-later" role="button" tabindex="0">나중에</span></p>');
  $('cb-ok').onchange=function(){ $('cb-go').disabled=!this.checked; };
  $('cb-later').onclick=function(){ coreLaterSet(uid); closeSheet(); };
  $('cb-go').onclick=async function(){
    $('cb-go').disabled=true; status('저장 중…');
    var r=await sb.from('core_profiles').upsert(coreRowFrom(uid,p),{onConflict:'user_id'});
    if(r.error){ status('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요','err'); $('cb-go').disabled=false; return; }
    coreSaved();
  };
}
/* ② 아무 정보도 없을 때 — 여기서 입력하고 동의 */
function coreFirstSheet(){
  var uid=me.id, g='display:grid;gap:var(--sp-2);margin:0 0 var(--sp-2)';
  openSheet('<h2 style="margin-bottom:4px">처음 오셨네요! 생년월일을 알려 주세요</h2>'
   +'<p class="sub" style="margin:0 0 10px">한 번만 입력하면 모든 자림 앱에 자동으로 채워져요.</p>'
   +'<label>별명 <span class="opt">(선택)</span></label><input type="text" id="cb-nick" maxlength="20" autocomplete="nickname" placeholder="표시될 이름">'
   +'<div style="'+g+';grid-template-columns:1fr 1fr"><div><label>성별</label><select id="cb-gender"><option value="">선택</option><option value="female">여성</option><option value="male">남성</option></select></div>'
   +'<div><label>달력</label><select id="cb-cal"><option value="solar">양력</option><option value="lunar">음력(평달)</option><option value="lunar-leap">음력(윤달)</option></select></div></div>'
   +'<div style="'+g+';grid-template-columns:1.4fr 1fr 1fr"><div><label>태어난 해</label><input type="number" id="cb-y" inputmode="numeric" placeholder="1990"></div>'
   +'<div><label>월</label><input type="number" id="cb-mo" inputmode="numeric" placeholder="5"></div><div><label>일</label><input type="number" id="cb-d" inputmode="numeric" placeholder="15"></div></div>'
   +'<div style="'+g+';grid-template-columns:1fr 1fr"><div><label>시 <span class="opt">(0~23)</span></label><input type="number" id="cb-h" inputmode="numeric" placeholder="모르면 비움"></div>'
   +'<div><label>분</label><input type="number" id="cb-min" inputmode="numeric" placeholder="0"></div></div>'
   +CORE_CONSENT_HTML
   +'<div id="st" class="status" role="status"></div>'
   +'<button class="btn" id="cb-go" type="button" style="width:100%;margin-top:6px" disabled>저장하고 시작</button>'
   +'<p class="sub" style="text-align:center;margin:12px 0 0"><span class="switch" id="cb-later" role="button" tabindex="0">나중에</span></p>');
  $('cb-ok').onchange=function(){ $('cb-go').disabled=!this.checked; };
  $('cb-later').onclick=function(){ coreLaterSet(uid); closeSheet(); };
  $('cb-go').onclick=async function(){
    var v=function(i){ return $(i).value.trim(); }, n=function(i){ var x=v(i); return x===''?null:Number(x); };
    var bad=BirthCheck.msg(n('cb-y'),n('cb-mo'),n('cb-d'),n('cb-h'),n('cb-min'));
    if(bad){ status(bad,'err'); return; }
    var cal=v('cb-cal'), h=n('cb-h');
    var p={ nickname:v('cb-nick'), gender:v('cb-gender'), calendar:cal==='solar'?'solar':'lunar', leap:cal==='lunar-leap',
      birth_y:n('cb-y'), birth_mo:n('cb-mo'), birth_d:n('cb-d'), birth_h:h, birth_min:h===null?null:(n('cb-min')||0), time_unknown:h===null };
    $('cb-go').disabled=true; status('저장 중…');
    var r=await sb.from('core_profiles').upsert(coreRowFrom(uid,p),{onConflict:'user_id'});
    if(r.error){ status('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요','err'); $('cb-go').disabled=false; return; }
    var pf={ gender:p.gender||null, calendar:p.calendar, leap:p.leap, birth_y:p.birth_y, birth_mo:p.birth_mo, birth_d:p.birth_d,
      birth_h:p.birth_h, birth_min:p.birth_min, time_unknown:p.time_unknown };
    if(p.nickname) pf.nickname=p.nickname.slice(0,20);
    try{ await sb.from('profiles').update(pf).eq('id',uid); }catch(e){}   // 분석·만남 앱도 같은 정보로(실패해도 공용 정보는 저장됨)
    coreSaved();
  };
}
if(typeof module!=='undefined'&&module.exports) module.exports={coreRowFrom:coreRowFrom,coreBirthLine:coreBirthLine};
else if(typeof me!=='undefined'&&me&&typeof access!=='undefined'&&access.loaded) checkCoreConsent();   // 이 파일보다 로그인 확인이 먼저 끝난 경우
