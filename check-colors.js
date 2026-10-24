// 새 하드코딩 색 점검: node jalim-hub/check-colors.js  (프로젝트 루트에서)
//   기본        현재 색 사용을 color-baseline.json(기준선)과 견줘 '새로 늘어난 것'만 알린다. 늘어난 게 있으면 종료 코드 1.
//   --update    기준선을 지금 상태로 다시 쓴다. (오행색·카카오 노랑처럼 일부러 새 색을 넣었을 때만)
//   --list      파일별 색 사용 수와 많이 쓰는 색, 공통 토큰과 같은 값이면 어떤 토큰인지 보여준다. (정리 대상 찾기용)
// 원칙: 색은 jalim-base.css 의 토큰(var(--…))으로 쓴다. 토큰 값을 정의하는 줄(--이름:#색)과 흰색·검정(글자·그림자)은 센 대상이 아니다.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const FILES=['jalim-hub/index.html','jalim-hub/hub-auth.js','jalim-hub/hub-today.js','mating-app/index.html','analysis-app/index.html','counsel-tool/index.html','lotto-app/index.html','ohaeng-project/team-maker.html'];
const BASE_FILE=path.join(__dirname,'color-baseline.json');
const ALWAYS_OK=new Set(['#fff','#ffffff','#000','#000000']);   // 색 위의 글자·그림자 등

// 공통 토큰의 색값 → 토큰 이름 (제안용)
const tokenByHex={};
for(const m of fs.readFileSync(path.join(__dirname,'jalim-base.css'),'utf8').matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)){
  const h=norm(m[2]); if(!tokenByHex[h]) tokenByHex[h]=m[1];
}
function norm(h){ h=h.toLowerCase(); return h.length===4?'#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3]:h; }

// 주석을 빈칸으로 바꿔 센다 (줄 수·위치는 유지할 필요 없음)
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/(^|[\s;{}])\/\/[^\n]*/g,'$1');
}
// 한 파일의 색 사용: { '#rrggbb': 횟수, 'rgba(r,g,b)': 횟수 }
function scan(file){
  const text=stripComments(fs.readFileSync(path.join(root,file),'utf8'));
  const out={};
  const add=k=>{ out[k]=(out[k]||0)+1; };
  // 16진수 색. 앞이 '--이름:' (토큰 정의)이면 제외. 주소 해시(#intake 등)는 6자리가 아니거나 글자가 섞여 있어 걸러진다.
  for(const m of text.matchAll(/#([0-9a-fA-F]{3,8})\b/g)){
    const len=m[1].length; if(![3,4,6,8].includes(len)) continue;
    const before=text.slice(Math.max(0,m.index-40),m.index);
    if(/--[\w-]+\s*:\s*$/.test(before)) continue;                     // 토큰 정의
    if(/(href|location\.hash|getElementById|querySelector\w*)\s*[=(]\s*['"`]?$/.test(before)) continue;   // 주소·선택자
    if(/\b(href|src)=["']$/.test(before)) continue;
    if(len===3 && /^[0-9a-f]{3}$/i.test(m[1]) && !/[:\s,(]\s*$/.test(before) && !/['"`]$/.test(before)) continue;
    const h=norm('#'+m[1]); if(ALWAYS_OK.has(h)) continue;
    add(h);
  }
  // rgba/rgb 중 검정·흰색 투명도(그림자·막)는 제외
  for(const m of text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)){
    const [r,g,b]=[+m[1],+m[2],+m[3]];
    if((r===0&&g===0&&b===0)||(r===255&&g===255&&b===255)) continue;
    add(`rgb(${r},${g},${b})`);
  }
  return out;
}
const now={}; for(const f of FILES) now[f]=scan(f);

const arg=process.argv[2];
if(arg==='--update'){
  fs.writeFileSync(BASE_FILE,JSON.stringify(now,null,1)+'\n');
  console.log('기준선을 갱신했습니다:',Object.entries(now).map(([f,c])=>`${f} ${Object.values(c).reduce((a,b)=>a+b,0)}`).join(' · '));
  process.exit(0);
}
if(arg==='--list'){
  for(const f of FILES){
    const c=now[f], total=Object.values(c).reduce((a,b)=>a+b,0);
    console.log(`\n${f}  — 색 ${Object.keys(c).length}종 · ${total}곳`);
    for(const [k,n] of Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,8))
      console.log(`  ${String(n).padStart(3)}  ${k}${tokenByHex[k]?`   ← 공통 토큰 ${tokenByHex[k]} 와 같은 값`:''}`);
  }
  process.exit(0);
}
if(!fs.existsSync(BASE_FILE)){ console.error('기준선이 없습니다. 먼저 --update 로 만드세요.'); process.exit(2); }
const base=JSON.parse(fs.readFileSync(BASE_FILE,'utf8'));
let bad=0;
for(const f of FILES){
  const b=base[f]||{}, c=now[f];
  const grew=Object.keys(c).filter(k=>c[k]>(b[k]||0));
  if(!grew.length){ console.log('좋음  '+f); continue; }
  bad+=grew.length;
  console.log('새 색  '+f);
  for(const k of grew)
    console.log(`        ${k}  ${b[k]||0}곳 → ${c[k]}곳${tokenByHex[k]?`   → var(${tokenByHex[k]}) 로 쓰세요`:'   (공통 토큰에 없는 색: 토큰을 먼저 정하거나, 의도한 색이면 --update)'}`);
}
console.log(bad?`\n새로 늘어난 하드코딩 색 ${bad}건`:'\n새로 늘어난 하드코딩 색 없음');
process.exit(bad?1:0);
