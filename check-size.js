// 500줄 점검: node jalim-hub/check-size.js  (프로젝트 루트에서)
//   기본        500줄을 넘는 파일을 size-baseline.json(기준선)과 견줘 '새로 넘은 파일'과 '더 커진 파일'만 알린다. 있으면 종료 코드 1.
//   --update    기준선을 지금 상태로 다시 쓴다. (파일을 쪼개 줄였을 때, 또는 일부러 예외를 인정할 때만)
//   --list      500줄 넘는 파일을 큰 순서로 보여준다. (쪼갤 대상 찾기용)
// 원칙: 한 파일은 500줄 이하. 기존에 넘던 파일은 현재 줄 수를 기준선으로 고정하고 더 커지는 것만 막는다.
//   데이터 파일·외부 라이브러리·빌드 결과물은 EXEMPT 에 둔다. 설계: docs/engine-dev-guardrails-plan.md
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const LIMIT=500;
const BASE_FILE=path.join(__dirname,'size-baseline.json');
const EXTS=new Set(['.js','.mjs','.ts','.html','.css']);
const SKIP_DIRS=new Set(['node_modules','.git','_engine-backups','docs','jalim-engine','jamidusu-study','yongsin-calibration','.claude']);
// 예외: 만세력·인물 데이터, 외부 라이브러리, 앱 안 엔진 사본(빌드 결과물), 압축 파일
const EXEMPT_FILES=new Set(['ohaeng-project/engine/src/saju/manse-inline.js','ohaeng-project/engine/src/persona/characters.js','lotto-app/jsQR.min.js']);
const isExempt=rel=>EXEMPT_FILES.has(rel)||/(^|\/)engine\.browser\.js$/.test(rel)||/\.min\.(js|css)$/.test(rel);

function walk(dir,out){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(e.isDirectory()){ if(!SKIP_DIRS.has(e.name)) walk(path.join(dir,e.name),out); continue; }
    if(!EXTS.has(path.extname(e.name).toLowerCase())) continue;
    const full=path.join(dir,e.name), rel=path.relative(root,full).split(path.sep).join('/');
    if(isExempt(rel)) continue;
    const text=fs.readFileSync(full,'utf8');
    const lines=text.length?text.split('\n').length-(text.endsWith('\n')?1:0):0;
    out[rel]=lines;
  }
  return out;
}
const all=walk(root,{});
const over={}; for(const [f,n] of Object.entries(all)) if(n>LIMIT) over[f]=n;

const arg=process.argv[2];
if(arg==='--update'){
  fs.writeFileSync(BASE_FILE,JSON.stringify(Object.fromEntries(Object.entries(over).sort((a,b)=>b[1]-a[1])),null,1)+'\n');
  console.log(`기준선을 갱신했습니다: ${LIMIT}줄 넘는 파일 ${Object.keys(over).length}개 (점검 대상 ${Object.keys(all).length}개)`);
  process.exit(0);
}
if(arg==='--list'){
  console.log(`${LIMIT}줄 넘는 파일 (점검 대상 ${Object.keys(all).length}개 중 ${Object.keys(over).length}개)\n`);
  for(const [f,n] of Object.entries(over).sort((a,b)=>b[1]-a[1])) console.log(`${String(n).padStart(6)}  ${f}`);
  process.exit(0);
}
if(!fs.existsSync(BASE_FILE)){ console.error('기준선이 없습니다. 먼저 --update 로 만드세요.'); process.exit(2); }
const base=JSON.parse(fs.readFileSync(BASE_FILE,'utf8'));
let bad=0;
for(const [f,n] of Object.entries(over).sort((a,b)=>b[1]-a[1])){
  const b=base[f];
  if(b===undefined){ bad++; console.log(`새로 넘음  ${f}  ${n}줄 (한도 ${LIMIT}) — 기능별로 나누세요`); }
  else if(n>b){ bad++; console.log(`더 커짐    ${f}  ${b}줄 → ${n}줄 — 늘린 만큼 다른 파일로 빼세요`); }
}
const shrunk=Object.keys(base).filter(f=>(all[f]||0)<=LIMIT||(over[f]!==undefined&&over[f]<base[f]));
if(shrunk.length) console.log(`\n줄어든 파일 ${shrunk.length}개: 기준선을 낮추려면 --update (${shrunk.join(', ')})`);
console.log(bad?`\n500줄 규칙 위반 ${bad}건`:`\n500줄 규칙 위반 없음 (기준선 ${Object.keys(base).length}개 파일 유지 중)`);
process.exit(bad?1:0);
