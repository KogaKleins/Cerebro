const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'services', 'achievement.service.ts');
const s = fs.readFileSync(file, 'utf8');
let line = 1;
let balance = 0;
for (const ch of s) {
  if (ch === '\n') line++;
}

const lines = s.split('\n');
let bal = 0;
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  let inc = 0;
  for (const c of ln) {
    if (c === '{') { bal++; inc++; }
    if (c === '}') { bal--; inc--; }
  }
  if (ln.includes('{') || ln.includes('}')) {
    console.log(`${i+1}: ${ln.trim()}  -> inc=${inc} balance=${bal}`);
  }
}
console.log('Final balance:', bal);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('try {')) console.log('try at', i+1, lines[i].trim());
  if (lines[i].includes('catch (')) console.log('catch at', i+1, lines[i].trim());
}
console.log('--- Context around error lines 170-200 ---');
console.log(lines.slice(170,200).map((l,idx)=>`${170+idx+1}: ${l}`).join('\n'));
console.log('\n--- Full file with line numbers ---');
lines.forEach((l, idx) => console.log(`${idx+1}: ${l}`));
