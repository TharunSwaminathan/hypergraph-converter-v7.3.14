import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { browserFixture } from './measure-scope6b.mjs';
const directory=mkdtempSync(join(tmpdir(),'candy-scope6b-fixtures-'));
const fixtures=[];
for(const family of ['S2','B1','B4','B5']) {
  const rows=browserFixture(family);
  const text=rows.map(edge=>`${edge.id}: ${edge.vertices.join(', ')}`).join('\n');
  const path=join(directory,`${family}.h2v.txt`);writeFileSync(path,text);
  fixtures.push({family,path,E:rows.length,I:rows.reduce((n,e)=>n+e.vertices.length,0),bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
}
writeFileSync('artifacts/candy-scope6b-browser-fixtures.json',JSON.stringify({seed:731406,fixtures},null,2)+'\n');
console.log(JSON.stringify(fixtures,null,2));
