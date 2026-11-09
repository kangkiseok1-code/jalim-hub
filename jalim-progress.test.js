const test=require('node:test'),assert=require('node:assert/strict');
const {steps,line}=require('./jalim-progress.js');
test('아무것도 안 했으면 사주부터',()=>{ const p=steps({core:false,walk:0,tests:0,counsel:null}); assert.equal(p.done,0); assert.equal(p.next.k,'saju'); assert.equal(line(p),'지금 0/4 · 다음은 사주'); });
test('사주·걷기 했으면 다음은 설문',()=>{ const p=steps({core:true,walk:3,tests:0,counsel:null}); assert.equal(p.done,2); assert.equal(p.next.k,'test'); });
test('상담 신청 후 대기',()=>{ const p=steps({core:true,walk:1,tests:1,counsel:'pending'}); assert.equal(p.done,3); assert.equal(p.next,null); assert.equal(p.steps[3].state,'wait'); assert.equal(line(p),'상담 승인을 기다리고 있어요'); });
test('승인되면 모두 마침, 거절은 다시 하러 가기',()=>{ assert.equal(line(steps({core:true,walk:1,tests:1,counsel:'approved'})),'모든 단계를 마쳤어요'); assert.equal(steps({core:true,walk:1,tests:1,counsel:'rejected'}).next.k,'counsel'); });
