import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQualificationJsonCache } from '../candy-runtime/src/capabilities/qualificationJson.js';
import { verifyQualifiedMotifBackend } from '../candy-runtime/src/capabilities/motifQualification.js';
const cache=createQualificationJsonCache({maxEntries:2,maxBytes:100});
const source=Buffer.from('{"nested":{"value":1}}');const a=cache.parse(source);assert.equal(cache.parse(Buffer.from(source)),a);
assert.ok(Object.isFrozen(a.nested));assert.throws(()=>a.nested.value=2);source[19]=50;
const changed=cache.parse('{"nested":{"value":2}}');assert.equal(changed.nested.value,2);assert.notEqual(changed,a);
assert.throws(()=>cache.parse('{"nested":'),SyntaxError);assert.equal(cache.parse('{"nested":{"value":1}}'),a);
for(let i=0;i<100;i++)cache.parse(JSON.stringify({i}));assert.ok(cache.stats().entries<=2 && cache.stats().sourceBytes<=100);assert.ok(cache.stats().hits>=2);
// Fresh bytes at an unchanged path are parsed again; timestamps are irrelevant.
const root=await mkdtemp(join(tmpdir(),'candy-scope6c-qual-'));
try{const path=join(root,'record.json');await writeFile(path,'{"ok":true}');assert.equal(cache.parse(await readFile(path)).ok,true);await writeFile(path,'{"ok":false}');assert.equal(cache.parse(await readFile(path)).ok,false);
assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:root},'CUDA_STATIC')).available,false);
await writeFile(path,'broken');assert.throws(()=>cache.parse('broken'));assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:root},'CUDA_INCREMENTAL')).available,false);
}finally{await rm(root,{recursive:true});}
console.log('Scope6C bounded exact-byte immutable parsing reuse, changed/malformed source invalidation and untrusted qualification rejection passed.');
