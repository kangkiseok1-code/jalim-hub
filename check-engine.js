#!/usr/bin/env node
/* 공유 엔진 점검 — 각 앱이 어느 버전의 jalim-engine을 어떤 지문으로 쓰는지 한눈에 보여 주고, 어긋남을 찾는다.
 *
 * 사용법 (프로젝트 아무 곳에서나):
 *   node jalim-hub/check-engine.js          # 로컬 파일만 점검
 *   node jalim-hub/check-engine.js --live   # 라이브(GitHub Pages)의 엔진 파일 지문과 각 앱 라이브 페이지의 고정값도 점검
 *
 * 오류(종료 코드 1): 앱이 적은 지문이 versions.json 기록과 다름 / 엔진 폴더 파일의 실제 지문이 기록과 다름 /
 *   sw.js가 미리 저장하는 엔진 주소가 앱 페이지와 다름 / 앱이 아직 앱 안 엔진 파일(engine.browser.js)을 참조함
 * 알림(오류 아님): 앱마다 버전이 다름(단계 배포 중에는 정상) / 앱 안 옛 사본 파일이 남아 있음(4단계에서 삭제 예정)
 * 설계: docs/engine-unification-design.md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const LIVE = process.argv.includes('--live');
const BASE = 'https://kangkiseok1-code.github.io';
// [표시 이름, 폴더, 라이브 경로, 엔진을 부르는 파일들(첫 번째가 대표), sw.js 있는지]
const APPS = [
  ['기운 체크인', 'checkin', '/checkin/', ['index.html'], true],
  ['같이 걷기', 'life-walk', '/life-walk/', ['index.html', 'together.html'], true],
  ['재물운', 'lotto-app', '/lotto-app/', ['index.html'], true],
  ['분석', 'analysis-app', '/analysis-app/', ['index.html'], true],
  ['만남', 'mating-app', '/mating-app/', ['index.html'], true],
  ['심화상담', 'counsel-tool', '/counsel-tool/', ['index.html'], true],
  ['팀메이커', 'ohaeng-project', '/Team-maker/', ['team-maker.html'], true],
  ['허브 오늘의 기운', 'jalim-hub', '/jalim-hub/', ['hub-today.js'], false],
];
const PIN_HTML = /\/jalim-engine\/v(\d+\.\d+\.\d+)\/engine\.js"\s+integrity="(sha384-[^"]+)"/;
const PIN_JS_URL = /\/jalim-engine\/v(\d+\.\d+\.\d+)\/engine\.js'/;
const PIN_JS_SRI = /TODAY_ENGINE_SRI\s*=\s*'(sha384-[^']+)'/;
const sri = buf => 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
const get = url => new Promise((ok, fail) => https.get(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), r => {
  const c = []; r.on('data', d => c.push(d)); r.on('end', () => ok({ status: r.statusCode, body: Buffer.concat(c) }));
}).on('error', fail));

const errors = [], notes = [];
const err = m => errors.push(m), note = m => notes.push(m);

// 1) 기록(versions.json)과 엔진 폴더 파일 지문
const repo = path.join(ROOT, 'jalim-engine');
if (!fs.existsSync(path.join(repo, 'versions.json'))) { console.error('✗ jalim-engine/versions.json 이 없습니다'); process.exit(1); }
const reg = JSON.parse(fs.readFileSync(path.join(repo, 'versions.json'), 'utf8')).versions;
const known = {};
reg.forEach(v => {
  known[v.version] = v.sri;
  const f = path.join(repo, 'v' + v.version, 'engine.js');
  if (!fs.existsSync(f)) return err(`v${v.version}: 엔진 파일이 없습니다`);
  if (sri(fs.readFileSync(f)) !== v.sri) err(`v${v.version}: 엔진 파일의 실제 지문이 versions.json 기록과 다릅니다 (파일이 바뀜)`);
});
const latest = reg[reg.length - 1] && reg[reg.length - 1].version;

// 2) 앱별 고정값
const rows = [];
for (const [name, dir, live, files, hasSw] of APPS) {
  const row = { name, ver: '-', status: 'OK', extra: [] };
  const main = path.join(ROOT, dir, files[0]);
  if (!fs.existsSync(main)) { row.status = '없음'; err(`${name}: ${files[0]} 이 없습니다`); rows.push(row); continue; }
  const pins = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
    if (f.endsWith('.js')) {
      const u = text.match(PIN_JS_URL), s = text.match(PIN_JS_SRI);
      pins.push({ f, ver: u && u[1], sri: s && s[1] });
    } else {
      const m = text.match(PIN_HTML);
      pins.push({ f, ver: m && m[1], sri: m && m[2] });
      if (/<script[^>]+src="engine\.browser\.js"/.test(text)) err(`${name}: ${f} 가 아직 앱 안 engine.browser.js 를 참조합니다`);
    }
  }
  pins.forEach(p => {
    if (!p.ver || !p.sri) { err(`${name}: ${p.f} 에서 공유 엔진 고정값(버전·지문)을 찾지 못했습니다`); row.status = '오류'; return; }
    if (!known[p.ver]) { err(`${name}: ${p.f} 가 등록되지 않은 버전 v${p.ver} 을 가리킵니다`); row.status = '오류'; }
    else if (known[p.ver] !== p.sri) { err(`${name}: ${p.f} 의 지문이 v${p.ver} 기록과 다릅니다`); row.status = '오류'; }
  });
  const vers = [...new Set(pins.map(p => p.ver))];
  if (vers.length > 1) { err(`${name}: 화면 파일끼리 버전이 다릅니다 (${vers.join(', ')})`); row.status = '오류'; }
  row.ver = vers[0] ? 'v' + vers[0] : '-';
  if (hasSw) {
    const swf = path.join(ROOT, dir, 'sw.js'), sw = fs.existsSync(swf) ? fs.readFileSync(swf, 'utf8') : '';
    const m = sw.match(/\/jalim-engine\/v(\d+\.\d+\.\d+)\/engine\.js/);
    if (!m) { err(`${name}: sw.js 가 엔진 주소를 미리 저장하지 않습니다 (오프라인에서 엔진이 없을 수 있음)`); row.status = '오류'; }
    else if (vers[0] && m[1] !== vers[0]) { err(`${name}: sw.js(v${m[1]})와 화면 파일(v${vers[0]})의 엔진 버전이 다릅니다`); row.status = '오류'; }
    else if (/engine\.browser\.js/.test(sw)) { err(`${name}: sw.js 가 아직 engine.browser.js 도 저장합니다`); row.status = '오류'; }
    const cm = sw.match(/const CACHE\s*=\s*'([^']+)'/); row.cache = cm ? cm[1] : '-';
  } else row.cache = '(해당 없음)';
  const copy = path.join(ROOT, dir, 'engine.browser.js');
  if (fs.existsSync(copy)) row.extra.push('옛 사본 남음');
  rows.push(row);
}
const used = [...new Set(rows.map(r => r.ver).filter(v => v !== '-'))];
if (used.length > 1) note(`앱마다 쓰는 버전이 다릅니다: ${used.join(', ')} (엔진을 단계 배포하는 중이면 정상)`);
if (latest && rows.some(r => r.ver !== 'v' + latest && r.ver !== '-')) note(`최신 등록 버전은 v${latest} 입니다. 아직 올리지 않은 앱: ${rows.filter(r => r.ver !== 'v' + latest).map(r => r.name).join(', ')}`);
const copies = rows.filter(r => r.extra.includes('옛 사본 남음')).length;
if (copies) note(`앱 안에 옛 엔진 사본(engine.browser.js)이 ${copies}곳 남아 있습니다 (4단계에서 삭제 예정)`);

(async () => {
  // 3) 라이브 점검
  if (LIVE) {
    for (const v of reg) {
      const r = await get(`${BASE}/jalim-engine/v${v.version}/engine.js`);
      if (r.status !== 200) err(`라이브 v${v.version}: 응답 ${r.status}`);
      else if (sri(r.body) !== v.sri) err(`라이브 v${v.version}: 실제 지문이 기록과 다릅니다`);
    }
    for (const [name, dir, live, files] of APPS) {
      const r = await get(`${BASE}${live}${files[0]}`);
      if (r.status !== 200) { err(`라이브 ${name}: ${files[0]} 응답 ${r.status}`); continue; }
      const text = r.body.toString('utf8');
      const row = rows.find(x => x.name === name);
      if (files[0].endsWith('.js')) {
        const u = text.match(PIN_JS_URL); if (!u || 'v' + u[1] !== row.ver) err(`라이브 ${name}: 고정 버전이 로컬(${row.ver})과 다릅니다`);
      } else {
        const m = text.match(PIN_HTML); if (!m || 'v' + m[1] !== row.ver) err(`라이브 ${name}: 고정 버전이 로컬(${row.ver})과 다릅니다`);
        else if (known[m[1]] !== m[2]) err(`라이브 ${name}: 지문이 기록과 다릅니다`);
      }
    }
  }

  // 출력
  const w = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
  console.log(`공유 엔진 점검 (${LIVE ? '로컬 + 라이브' : '로컬'})  등록 버전: ${reg.map(v => 'v' + v.version).join(', ')}\n`);
  console.log(w('앱', 20) + w('버전', 8) + w('상태', 6) + w('SW 캐시', 22) + '비고');
  rows.forEach(r => console.log(w(r.name, 20) + w(r.ver, 8) + w(r.status, 6) + w(r.cache || '', 22) + r.extra.join(', ')));
  if (notes.length) { console.log('\n알림'); notes.forEach(n => console.log('  · ' + n)); }
  if (errors.length) { console.log('\n오류'); errors.forEach(e => console.log('  ✗ ' + e)); console.log(`\n✗ 오류 ${errors.length}건`); process.exit(1); }
  console.log('\n✓ 이상 없음');
})();
