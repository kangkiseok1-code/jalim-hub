/* 허브 화면 진단 — 주소 끝에 ?diag=1 을 붙여 열 때만 불러온다(index.html 맨 아래). 읽기만 하고 화면·데이터는 바꾸지 않는다.
   화면 아래에 상태를 적어 주고 [복사] 버튼으로 그대로 붙여넣을 수 있게 한다. 직전 3번의 열기 기록도 함께 남긴다. */
(function(){
  var errs=[], pr=null;
  window.addEventListener('error',function(e){errs.push('오류: '+(e.message||'')+' @'+String(e.filename||'').split('/').pop()+':'+e.lineno)});
  window.addEventListener('unhandledrejection',function(e){errs.push('거절된 약속: '+String(e.reason&&e.reason.message||e.reason).slice(0,100))});
  window.addEventListener('pagereveal',function(e){pr=e.viewTransition?'화면 전환 효과가 이 페이지에 적용됨':'화면 전환 효과 없음'});
  function box(){
    var b=document.getElementById('diag-box');
    if(!b){ b=document.createElement('div'); b.id='diag-box';
      b.style.cssText='margin:24px 0;padding:12px;border:2px dashed #c8264f;border-radius:12px;background:#fff;font:12px/1.5 monospace;white-space:pre-wrap;word-break:break-all;color:#121212';
      var btn=document.createElement('button'); btn.type='button'; btn.textContent='복사'; btn.id='diag-copy';
      btn.style.cssText='display:block;margin:0 0 8px;padding:8px 16px;font:14px sans-serif';
      btn.onclick=function(){ var t=document.getElementById('diag-text').textContent; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){btn.textContent='복사됨 — 채팅에 붙여넣으세요'}).catch(function(){var r=document.createRange();r.selectNodeContents(document.getElementById('diag-text'));var s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='선택됨 — 직접 복사(Ctrl+C)하세요'}) };
      var pre=document.createElement('div'); pre.id='diag-text';
      b.appendChild(btn); b.appendChild(pre); document.body.appendChild(b);
    }
    return document.getElementById('diag-text');
  }
  function snap(label){
    var g=document.getElementById('grid'), c=document.querySelector('#grid .card'), L=[];
    var nav=performance.getEntriesByType('navigation')[0]||{};
    L.push('['+label+'] '+new Date().toLocaleTimeString('ko-KR'));
    L.push('이동 방식: '+(nav.type||'?')+' · 화면 보임: '+document.visibilityState+' · 서비스워커 제어: '+(navigator.serviceWorker&&navigator.serviceWorker.controller?'예':'아니오'));
    L.push('창 크기: '+innerWidth+'x'+innerHeight+' · 움직임 줄이기: '+matchMedia('(prefers-reduced-motion: reduce)').matches+' · 어두운 모드: '+matchMedia('(prefers-color-scheme: dark)').matches);
    L.push('카드 수: '+document.querySelectorAll('#grid .card').length+' · #grid: '+(g?getComputedStyle(g).display+' / 높이 '+Math.round(g.getBoundingClientRect().height):'없음'));
    if(c){ var cs=getComputedStyle(c), r=c.getBoundingClientRect();
      L.push('첫 카드: 투명도 '+cs.opacity+' · visibility '+cs.visibility+' · display '+cs.display+' · 위치 y='+Math.round(r.top)+' 높이 '+Math.round(r.height)+' · transform '+cs.transform.slice(0,30));
      var el=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)); L.push('첫 카드 한가운데 위에 있는 것: '+(el?el.tagName+'.'+(el.className&&el.className.baseVal===undefined?el.className:'')+(el.id?'#'+el.id:''):'없음')); }
    var an=document.getAnimations(); L.push('애니메이션 '+an.length+'개: '+an.slice(0,6).map(function(a){return (a.animationName||a.transitionProperty||'?')+':'+a.playState}).join(', '));
    L.push('상단 알림 요소: today.hidden='+(document.getElementById('today')||{}).hidden+' · 시트/막 개수='+document.querySelectorAll('.jn-sheet,.jn-scrim').length);
    var res=performance.getEntriesByType('resource').filter(function(e){return /jalim-base|hub-auth|hub-today|supabase|pretendard|fonts\.g/.test(e.name)}).map(function(e){return e.name.split('/').pop().split('?')[0].slice(0,22)+' '+Math.round(e.duration)+'ms'+(e.transferSize===0?'(캐시)':'')+(e.responseStatus&&e.responseStatus>=400?' 상태'+e.responseStatus:'')});
    L.push('불러온 파일: '+res.join(' | '));
    L.push(pr||'화면 전환 효과: 알 수 없음');
    if(errs.length) L.push(errs.join('\n'));
    return L.join('\n');
  }
  function run(){
    var out=snap('열린 직후'), first=true, hist=[];
    try{ hist=JSON.parse(sessionStorage.getItem('hub_diag')||'[]') }catch(e){}
    var t=box(); t.textContent=out+(hist.length?'\n\n--- 이전 열기 기록 ---\n'+hist.join('\n\n'):'');
    setTimeout(function(){
      var later=snap('1.5초 뒤');
      t.textContent=later+'\n\n'+out+(hist.length?'\n\n--- 이전 열기 기록 ---\n'+hist.join('\n\n'):'');
      hist.unshift(later); hist=hist.slice(0,3);
      try{ sessionStorage.setItem('hub_diag',JSON.stringify(hist)) }catch(e){}
    },1500);
  }
  if(document.readyState==='complete') run(); else window.addEventListener('load',function(){setTimeout(run,100)});
})();
