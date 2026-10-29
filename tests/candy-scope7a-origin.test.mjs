import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const port = server.address().port;
const child = spawn(process.execPath, ['scripts/launcher-preflight.mjs', 'find-frontend-port', String(port)], { windowsHide: true });
let stdout = '', stderr = ''; child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
assert.equal((await once(child, 'exit'))[0], 2); assert.equal(stdout, '');
assert.match(stderr, /occupied/); assert.match(stderr, /Changing origin changes browser persistence/);
assert.match(stderr, /no data is relocated/); assert.equal(server.listening, true);
await new Promise(resolve => server.close(resolve));
const advanced = spawn(process.execPath, ['scripts/launcher-preflight.mjs', 'find-frontend-port', String(port), '1'], { windowsHide: true });
let advancedOut = '', advancedError = '';
advanced.stdout.on('data', value => { advancedOut += value; }); advanced.stderr.on('data', value => { advancedError += value; });
assert.equal((await once(advanced, 'exit'))[0], 0); assert.equal(advancedOut, String(port));
assert.match(advancedError, /Noncanonical frontend origin/); assert.match(advancedError, /no saved data is relocated/);
for (const file of ['run-with-ollama.bat', 'run-with-ollama.sh']) {
  const text = await readFile(file, 'utf8');
  assert.match(text, /find-frontend-port 5173 1/); assert.doesNotMatch(text, /find-frontend-port 5173 20/);
  assert.match(text, /Noncanonical origin/); assert.match(text, /no saved data is relocated/);
  assert.match(text, /--strictPort/); assert.doesNotMatch(text, /HYPERGRAPH_BRIDGE_ORIGINS[^\r\n]*=\*/);
}
assert.notEqual(new URL('http://127.0.0.1:5173').origin, new URL('http://127.0.0.1:5174').origin);
assert.notEqual(new URL('http://localhost:5173').origin, new URL('http://127.0.0.1:5173').origin);
for (const file of ['run-dev.sh', 'run-dev.bat', 'run-preview.sh', 'run-preview.bat']) {
  const text = await readFile(file, 'utf8');
  assert.match(text, /find-frontend-port 5173 1/); assert.match(text, /--port 5173 --strictPort/);
  assert.match(text, /No saved data is relocated across origins/);
}
console.log('Scope 7A P11/R48: occupied canonical/explicit origin policy, no silent fallback, no listener termination, no origin widening PASS.');
