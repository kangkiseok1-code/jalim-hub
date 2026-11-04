// jalim-tokens.js 시험: node --test jalim-hub/jalim-tokens.test.js
const test = require('node:test'), assert = require('node:assert');
function load(vars) {
  global.document = { documentElement: {} };
  global.getComputedStyle = () => ({ getPropertyValue: n => vars[n] || '' });
  delete require.cache[require.resolve('./jalim-tokens.js')];
  return require('./jalim-tokens.js');
}
test('토큰 값을 읽고 공백을 없앤다', () => {
  const JT = load({ '--wood': ' #0e8a5f ' });
  assert.strictEqual(JT.c('--wood'), '#0e8a5f');
});
test('없는 토큰은 기본값, 기본값도 없으면 빈 문자열', () => {
  const JT = load({});
  assert.strictEqual(JT.c('--nope', '#123'), '#123');
  assert.strictEqual(JT.c('--nope'), '');
});
test('오행 한글 이름과 종류(soft·ink)로 읽는다', () => {
  const JT = load({ '--fire': '#c8264f', '--fire-soft': '#f3736f', '--fire-ink': '#ffffff' });
  assert.strictEqual(JT.oh('화'), '#c8264f');
  assert.strictEqual(JT.oh('화', 'soft'), '#f3736f');
  assert.strictEqual(JT.oh('fire', 'ink'), '#ffffff');
});
test('값이 있을 때만 저장하고 reset 하면 다시 읽는다', () => {
  const vars = {}; const JT = load(vars);
  assert.strictEqual(JT.c('--x'), '');
  vars['--x'] = '#abc'; assert.strictEqual(JT.c('--x'), '#abc');
  vars['--x'] = '#def'; assert.strictEqual(JT.c('--x'), '#abc');
  JT.reset(); assert.strictEqual(JT.c('--x'), '#def');
});
test('face: 오행 면+글자를 한 번에', () => {
  const JT = load({});
  assert.strictEqual(JT.face('목'), 'background:var(--wood-soft);color:var(--wood-ink)');
  assert.strictEqual(JT.face('fire'), 'background:var(--fire-soft);color:var(--fire-ink)');
});
test('soft: 진한 오행·먹·금색·파랑을 파스텔/초록으로, 나머지는 그대로', () => {
  const JT = load({ '--wood': '#0e8a5f', '--ink': '#121212' });
  assert.strictEqual(JT.soft('var(--wood)'), 'var(--wood-soft)');
  assert.strictEqual(JT.soft('#0E8A5F'), 'var(--wood-soft)');
  assert.strictEqual(JT.soft('var(--ink)'), 'var(--accent)');
  assert.strictEqual(JT.soft('var(--gold)'), 'var(--accent)');
  assert.strictEqual(JT.soft('var(--info)'), 'var(--metal-soft)');
  assert.strictEqual(JT.soft('#abcdef'), '#abcdef');
  assert.strictEqual(JT.soft(''), '');
});
