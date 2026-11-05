const test=require('node:test'),assert=require('node:assert/strict');
const {coreRowFrom,coreBirthLine}=require('./hub-core.js');
test('시각 모름이면 시·분을 비운다',()=>{
  const r=coreRowFrom('u1',{nickname:' 가나 ',gender:'male',calendar:'solar',birth_y:1990,birth_mo:5,birth_d:15,birth_h:null,time_unknown:true});
  assert.equal(r.birth_h,null); assert.equal(r.birth_min,null); assert.equal(r.time_unknown,true); assert.equal(r.nickname,'가나');
});
test('음력 윤달만 leap',()=>{
  assert.equal(coreRowFrom('u',{calendar:'lunar',leap:true,birth_y:1990,birth_mo:5,birth_d:1,birth_h:8,birth_min:0}).leap,true);
  assert.equal(coreRowFrom('u',{calendar:'solar',leap:true,birth_y:1990,birth_mo:5,birth_d:1,birth_h:8}).leap,false);
});
test('성별은 male/female만, 동의 버전이 붙는다',()=>{
  const r=coreRowFrom('u',{gender:'x',birth_y:1990,birth_mo:5,birth_d:1,birth_h:8});
  assert.equal(r.gender,null); assert.equal(r.consent_version,'v1'); assert.ok(r.consent_at);
});
test('요약 문구',()=>{
  assert.equal(coreBirthLine({birth_y:1986,birth_mo:9,birth_d:17,birth_h:8,birth_min:30,calendar:'solar'}),'1986년 9월 17일 · 8시 30분');
  assert.equal(coreBirthLine({birth_y:1986,birth_mo:9,birth_d:17,time_unknown:true,calendar:'lunar'}),'1986년 9월 17일 (음력)');
});
