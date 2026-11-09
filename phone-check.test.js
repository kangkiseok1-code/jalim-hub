const test=require('node:test'),assert=require('node:assert/strict');
const {clean,msg,format}=require('./phone-check.js');
test('하이픈·공백을 걷어낸다',()=>assert.equal(clean('010-1234 5678'),'01012345678'));
test('정상 번호는 빈 문구',()=>{ assert.equal(msg('010-1234-5678'),''); assert.equal(msg('0212345678'),''); assert.equal(msg('031-123-4567'),''); });
test('비었거나 짧으면 안내',()=>{ assert.match(msg(''),/입력/); assert.match(msg('123'),/확인/); assert.match(msg('1012345678'),/확인/); assert.match(msg('010123456789'),/확인/); });
test('보기 좋게 하이픈',()=>{ assert.equal(format('01012345678'),'010-1234-5678'); assert.equal(format('0212345678'),'02-1234-5678'); assert.equal(format('0311234567'),'031-123-4567'); });
