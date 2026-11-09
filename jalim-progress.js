/* jalim-progress.js — 앱 맨 위 '내 진행' 띠: 사주 → 걷기 → 설문 → 상담, 어디까지 했는지와 다음 단계를 보여 준다.
 * 로그인한 사람만(기록이 계정에 있어서). 쓰는 앱: JalimProgress.mount(sb, here)  — sb = 그 앱의 supabase 클라이언트, here = 지금 있는 단계(없으면 null).
 * 원본은 jalim-hub/, 앱 폴더 복사본은 node jalim-hub/check-sync.js --fix 로 맞춘다. 색·크기는 jalim-base.css의 토큰만 쓴다. */
(function (root) {
  var STEPS = [
    { k: 'saju', n: '사주', href: '/analysis-app/?go=saju' },
    { k: 'walk', n: '걷기', href: '/life-walk/' },
    { k: 'test', n: '설문', href: '/analysis-app/?go=trait' },
    { k: 'counsel', n: '상담', href: '/jalim-hub/?apply=counsel' }
  ];
  // d = { core:boolean, walk:number, tests:number, counsel:null|'pending'|'approved'|'rejected' } → { steps:[…state: done|wait|todo], done, next }
  function steps(d) {
    var st = [!!d.core, d.walk > 0, d.tests > 0, d.counsel === 'approved'].map(function (ok, i) {
      return { k: STEPS[i].k, n: STEPS[i].n, href: STEPS[i].href, state: ok ? 'done' : (i === 3 && d.counsel === 'pending') ? 'wait' : 'todo' };
    });
    return { steps: st, done: st.filter(function (s) { return s.state === 'done'; }).length, next: st.filter(function (s) { return s.state === 'todo'; })[0] || null };
  }
  function line(p) {
    if (p.next) return '지금 ' + p.done + '/4 · 다음은 ' + p.next.n;
    return p.steps[3].state === 'wait' ? '상담 승인을 기다리고 있어요' : '모든 단계를 마쳤어요';
  }
  var CSS = '.jp-bar{max-width:560px;margin:0 auto;padding:10px 16px 6px;font-size:12px;color:var(--sub)}'
    + '.jp-bar ol{display:flex;align-items:center;gap:0;list-style:none;margin:0;padding:0}'
    + '.jp-bar li{display:flex;align-items:center;gap:5px;white-space:nowrap}'
    + '.jp-bar li+li::before{content:"";width:14px;height:1px;background:var(--line-strong);margin:0 6px}'
    + '.jp-d{width:9px;height:9px;border-radius:50%;background:var(--line-strong)}'
    + '.jp-bar .done .jp-d{background:var(--ok)}.jp-bar .wait .jp-d{background:var(--gold)}'
    + '.jp-bar .here{color:var(--ink);font-weight:700}.jp-bar .here .jp-d{box-shadow:0 0 0 3px var(--gold-soft)}'
    + '.jp-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px}'
    + '.jp-row a{color:var(--ink);font-weight:700;text-decoration:none;white-space:nowrap}';
  async function load(sb, uid) {
    var d = { core: false, walk: 0, tests: 0, counsel: null }, one = async function (fn) { try { return await fn(); } catch (e) { return null; } };
    var r = await Promise.all([
      one(function () { return sb.from('core_profiles').select('user_id', { count: 'exact', head: true }).eq('user_id', uid); }),
      one(function () { return sb.from('journey_answers').select('year', { count: 'exact', head: true }).eq('user_id', uid); }),
      one(function () { return sb.from('profiles').select('birth_y,profile,prefs,ipc').eq('id', uid).maybeSingle(); }),
      one(function () { return sb.from('app_access').select('status').eq('app', 'counsel').eq('user_id', uid).maybeSingle(); })
    ]);
    var p = (r[2] && r[2].data) || {};
    d.core = !!((r[0] && r[0].count) || p.birth_y);
    d.walk = (r[1] && r[1].count) || 0;
    d.tests = (Array.isArray(p.profile) && p.profile.some(Boolean) ? 1 : 0) + (Array.isArray(p.ipc) && p.ipc.some(Boolean) ? 1 : 0) + (p.prefs && typeof p.prefs === 'object' && Object.keys(p.prefs).length ? 1 : 0);
    d.counsel = (r[3] && r[3].data && r[3].data.status) || null;
    return d;
  }
  async function mount(sb, here) {
    if (!sb || typeof document === 'undefined' || document.getElementById('jp-bar')) return;
    try {
      var s = await sb.auth.getSession(), u = s.data && s.data.session && s.data.session.user; if (!u) return;
      var p = steps(await load(sb, u.id)), el = document.createElement('nav');
      el.id = 'jp-bar'; el.className = 'jp-bar'; el.setAttribute('aria-label', '내 진행');
      el.innerHTML = '<ol>' + p.steps.map(function (x) { return '<li class="' + x.state + (x.k === here ? ' here' : '') + '"><span class="jp-d"></span>' + x.n + '</li>'; }).join('') + '</ol>'
        + '<div class="jp-row"><span>' + line(p) + '</span>' + (p.next ? '<a href="' + p.next.href + '">' + p.next.n + ' ›</a>' : '') + '</div>';
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      document.body.insertBefore(el, document.body.firstChild);
    } catch (e) {}
  }
  var api = { steps: steps, line: line, mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JalimProgress = api;
})(typeof window !== 'undefined' ? window : this);
