/* hub-counsel.js — 심화상담 안내·신청·관리 화면. 순서: 절차 안내(준비 체크리스트) → 신청(전화번호·동의) → 승인 대기.
 * hub-auth.js의 전역(sb, me, access, openSheet, closeSheet, sheetEl, status, esc, $, toast, refreshAccess, CONSENT_VER, BASE, ANALYSIS_URL,
 * loadBirthCandidates)과 phone-check.js(PhoneCheck)를 쓴다. */

/* 내 준비 상태 — 사주 입력(필수) · 걷기 기록 · 성향 검사. 읽기만 한다 */
async function counselProgress(){
  var uid=me.id, p={core:false,walk:0,tests:0};
  try{ p.core=(await loadBirthCandidates()).length>0; }catch(e){}
  try{ var w=await sb.from('journey_answers').select('year',{count:'exact',head:true}).eq('user_id',uid); p.walk=w.count||0; }catch(e){}
  try{
    var q=await sb.from('profiles').select('profile,prefs,ipc').eq('id',uid).maybeSingle(), r=q.data||{};
    p.tests=(Array.isArray(r.profile)&&r.profile.some(Boolean)?1:0)+(Array.isArray(r.ipc)&&r.ipc.some(Boolean)?1:0)+(r.prefs&&typeof r.prefs==='object'&&Object.keys(r.prefs).length?1:0);
  }catch(e){}
  return p;
}
function guideRow(ok,label,tag,href){
  var chip=ok?'<span class="jn-chip ok">완료</span>':'<a class="jn-chip warn" href="'+href+'" style="text-decoration:none">하러 가기</a>';
  return '<li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)"><span>'+label+' <span style="color:var(--sub);font-size:.8rem">'+tag+'</span></span>'+chip+'</li>';
}
/* 1) 절차 안내 — 허브에서 심화상담을 누르면 가장 먼저 보인다 */
function counselGuide(again){
  openSheet('<h2 style="margin-bottom:4px">'+(again?'이번에는 승인되지 않았어요':'심화상담은 이렇게 진행돼요')+'</h2>'
   +'<p class="sub" style="margin:0 0 10px">'+(again?'준비를 보강해서 다시 신청하면 상담사가 한 번 더 확인해요.':'상담은 대부분 전화로 해요. 아래 순서로 진행돼요.')+'</p>'
   +'<ol style="margin:0 0 12px;padding-left:20px;font-size:.9rem;line-height:1.7"><li><b>신청</b> — 전화번호를 남기고 동의해요</li><li><b>승인</b> — 상담사가 확인해요</li><li><b>연락</b> — 남긴 번호로 전화드려요</li><li><b>이용</b> — 심화상담 앱에서 기록을 함께 봐요</li></ol>'
   +'<div class="consent"><b>내 준비 상태</b><ul id="cg-list" style="list-style:none;margin:6px 0 0;padding:0;font-size:.9rem"><li style="padding:8px 0;color:var(--sub)">확인 중…</li></ul>'
   +'<p>권장 항목은 건너뛰어도 신청할 수 있어요. 해 두면 상담이 더 깊어져요.</p></div>'
   +'<button class="btn" id="cg-go" type="button" style="width:100%;margin-top:10px">신청 절차 시작</button>');
  var prog=null, uid=me.id;
  counselProgress().then(function(p){
    if(!me||me.id!==uid||!$('cg-list')) return;
    prog=p;
    $('cg-list').innerHTML=guideRow(p.core,'사주 입력','(필수)',ROAD_LINK.core(ANALYSIS_URL,BASE))
      +guideRow(p.walk>0,'인생 다시 걷기','(권장)',ROAD_LINK.walk(ANALYSIS_URL,BASE))
      +guideRow(p.tests>0,'성향 설문','(권장)',ROAD_LINK.more(ANALYSIS_URL,BASE));
  });
  $('cg-go').onclick=function(){
    if(!prog){ toast('확인 중이에요. 잠시 뒤 다시 눌러주세요'); return; }
    if(!prog.core){ toast('먼저 사주를 입력해주세요'); return; }
    counselForm(again);
  };
}
/* 2) 신청 — 전화번호·통화 시간·동의 */
function counselForm(again){
  openSheet('<h2 style="margin-bottom:4px">'+(again?'다시 신청하기':'심화상담 신청')+'</h2>'
   +'<p class="sub" style="margin:0 0 10px">승인되면 남겨 주신 번호로 연락드려요.</p>'
   +'<label for="cf-ph">연락받을 전화번호</label><input id="cf-ph" type="tel" inputmode="numeric" autocomplete="tel" placeholder="010-1234-5678" maxlength="13">'
   +'<label for="cf-tm">통화 편한 시간 <span class="opt">(선택)</span></label><input id="cf-tm" type="text" maxlength="60" placeholder="평일 저녁 7시 이후" style="margin-bottom:10px">'
   +'<div class="consent"><b>정보 제공 동의 (필수)</b>'
   +'<p>신청하면 내가 입력하는 <b>생년월일시·출생지·상담 질문 답변·인생 사건</b>을 상담사가 상담을 위해 확인하는 것에 동의하는 것으로 봅니다.</p>'
   +'<p>상담을 보낼 때 <b>분석 앱의 성향·대인관계 결과, 지인 평가 요약, 인생 다시 걷기 기록</b>도 함께 보낼 수 있어요. 지인 평가는 응답을 평균으로 합친 요약만 가고, 응답한 지인의 이름·관계는 가지 않아요. 보내기 전에 항목마다 직접 고르며, 고르지 않은 것은 전달되지 않아요.</p>'
   +'<p>동의는 언제든 회원 탈퇴로 철회할 수 있고, 탈퇴하면 기록이 모두 삭제돼요.</p></div>'
   +'<div class="consent" style="margin-top:8px"><b>전화번호 수집 동의 (필수)</b>'
   +'<p>상담 연락을 위해 <b>전화번호와 통화 시간</b>을 수집하고, <b>상담이 끝나면 삭제</b>해요. 상담사 외에는 볼 수 없어요.</p></div>'
   +'<label class="chk"><input type="checkbox" id="agree"> 위 내용에 모두 동의합니다</label>'
   +'<div id="st" class="status" role="status"></div>'
   +'<button class="btn" id="req" type="button" style="width:100%;margin-top:6px" disabled>신청하기</button>'
   +'<button class="btn ghost" id="cf-back" type="button" style="width:100%;margin-top:6px">‹ 안내로</button>');
  $('agree').onchange=function(){$('req').disabled=!$('agree').checked};
  $('cf-ph').oninput=function(){ var d=PhoneCheck.clean(this.value); this.value=d.length>=9?PhoneCheck.format(d):d; if($('st')&&$('st').classList.contains('err')) status(''); };
  $('cf-back').onclick=function(){ counselGuide(again); };
  $('req').onclick=async function(){
    var m=PhoneCheck.msg($('cf-ph').value);
    if(m){ status(m,'err'); $('cf-ph').focus(); return; }
    $('req').disabled=true; status('신청 중…');
    var r=await sb.rpc('request_counsel',{p_consent_version:CONSENT_VER,p_phone:PhoneCheck.clean($('cf-ph').value),p_call_time:$('cf-tm').value});
    if(r.error){status('신청하지 못했어요: '+r.error.message,'err');$('req').disabled=false;return}
    await refreshAccess(); closeSheet(); toast('신청했어요. 승인되면 연락드릴게요');
  };
}
/* 관리자: 신청 관리 — 번호·통화 시간 표시, 전화 걸기, 상담이 끝나면 번호 삭제 */
function adminSheet(){
  var L=access.list, rows=L.map(function(x){
    var name=x.nickname||(x.email?x.email.split('@')[0]:'(이름 없음)'), uid=esc(x.user_id);
    var chip=x.status==='pending'?'<span class="jn-chip warn">대기</span>':x.status==='approved'?'<span class="jn-chip ok">승인</span>':'<span class="jn-chip bad">거절</span>';
    var when=(x.requested_at||'').slice(0,10);
    var btns=x.status==='pending'?'<button class="btn sm" data-uid="'+uid+'" data-act="approved" type="button">승인</button><button class="btn sm ghost" data-uid="'+uid+'" data-act="rejected" type="button">거절</button>'
      :x.status==='approved'?'<button class="btn sm ghost" data-uid="'+uid+'" data-act="rejected" type="button">승인 취소</button>'
      :'<button class="btn sm ghost" data-uid="'+uid+'" data-act="approved" type="button">승인</button>';
    var tel=x.phone?'<span class="sub"><a href="tel:'+esc(x.phone)+'" style="color:var(--ink);font-weight:600">'+esc(PhoneCheck.format(x.phone))+'</a>'+(x.call_time?' · '+esc(x.call_time):'')+'</span>'
      +'<button class="btn sm ghost" data-clear="'+uid+'" type="button">상담 끝 · 번호 삭제</button>':'';
    return '<div class="arow"><div class="ainfo"><b>'+esc(name)+'</b>'+chip+'<span class="sub">'+esc(x.email||'')+(when?' · '+esc(when):'')+'</span>'+tel+'</div><div class="aact">'+btns+'</div></div>';
  }).join('');
  openSheet('<h2 style="margin-bottom:4px">심화상담 신청 관리</h2>'
   +'<p class="sub" style="margin:0 0 10px">대기 중인 신청이 위에 나와요.</p>'
   +'<div id="st" class="status" role="status"></div>'
   +(rows||'<p class="sub">아직 신청이 없어요.</p>'));
  sheetEl.querySelectorAll('[data-act]').forEach(function(b){ b.onclick=async function(){
    var act=b.getAttribute('data-act'); b.disabled=true; status('처리 중…');
    var r=await sb.rpc('decide_app_access',{p_user:b.getAttribute('data-uid'),p_app:'counsel',p_status:act});
    if(r.error){status('처리하지 못했어요: '+r.error.message,'err');b.disabled=false;return}
    await refreshAccess(); adminSheet(); toast(act==='approved'?'승인했어요':'거절했어요');
  }; });
  sheetEl.querySelectorAll('[data-clear]').forEach(function(b){ b.onclick=async function(){
    b.disabled=true; status('삭제 중…');
    var r=await sb.rpc('clear_counsel_phone',{p_user:b.getAttribute('data-clear')});
    if(r.error){status('삭제하지 못했어요: '+r.error.message,'err');b.disabled=false;return}
    await refreshAccess(); adminSheet(); toast('번호를 삭제했어요');
  }; });
}
