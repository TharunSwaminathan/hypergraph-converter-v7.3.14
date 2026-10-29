import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { projectIndexedDB, turn } from './fixtures/candy-scope7a-storage.mjs';
import { createProjectStore } from '../src/persistence/projectStore.js';

const window = new Window({ url: 'http://127.0.0.1:5173/' });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const React = await import('react'), { act } = React, { createRoot } = await import('react-dom/client');
  const { usePersistentThread } = await vite.ssrLoadModule('/src/persistence/usePersistentThread.js');
  let mounted;
  function Host() {
    const [messages, setMessages] = React.useState([{ role: 'agent', text: 'Welcome' }]);
    const [memory, setMemory] = React.useState({ summary: '' });
    const persistence = usePersistentThread({ messages, setMessages, memory, setMemory, agentState: {} });
    mounted = { messages, setMessages, persistence };
    return React.createElement('p', { role: 'status' }, persistence.error || persistence.message);
  }
  const db = projectIndexedDB(); globalThis.indexedDB = db;
  const original = { schemaVersion: 1, id: 'main', messages: [{ role: 'agent', text: 'Historical', actions: [{ command: 'Apply' }] }], workspace: { graph: { available: true } } };
  db.records.set('main', structuredClone(original));
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Host))); for (let i = 0; i < 5; i++) await turn(); });
  assert.equal(mounted.persistence.status, 'ready'); assert.equal(mounted.messages[0].text, 'Historical');
  assert.deepEqual(mounted.messages[0].actions, []); assert.equal(mounted.persistence.restoredWorkspace.graph.available, false);
  assert.deepEqual(db.records.get('main'), original);
  const revision = mounted.persistence.receipt.committedRevision;
  db.control.holdCommit = true;
  await act(async () => { mounted.setMessages(value => [...value, { role: 'user', text: 'unsaved' }]); await turn(); });
  assert.equal(mounted.persistence.receipt.state, 'writing'); assert.equal(mounted.persistence.receipt.committedRevision, revision);
  assert.equal(mounted.persistence.receipt.unsaved, true); assert.match(document.body.textContent, /unsaved/);
  await act(async () => { db.releaseCommits(); await turn(); });
  assert.equal(mounted.persistence.receipt.state, 'committed'); assert.equal(mounted.persistence.receipt.committedRevision, revision + 1);
  const peer = createProjectStore(db), current = await peer.load(mounted.persistence.receipt.projectId);
  await peer.saveThread(current.manifest.projectId, current.manifest.revision, { schemaVersion: 1, messages: [{ role: 'user', text: 'other owner' }] });
  await act(async () => { mounted.setMessages(value => [...value, { role: 'user', text: 'local conflict' }]); await turn(); });
  assert.equal(mounted.persistence.receipt.state, 'conflict'); assert.equal(mounted.persistence.receipt.unsaved, true);
  assert.equal(mounted.messages.at(-1).text, 'local conflict');
  assert.equal((await peer.load(current.manifest.projectId)).record.messages[0].text, 'other owner');
  assert.match(document.body.textContent, /not saved/);
  await act(async () => root.unmount()); await peer.close();

  for (const fixture of ['future', 'unavailable']) {
    if (fixture === 'future') { const data = projectIndexedDB(); data.records.set('main', { schemaVersion: 99, id: 'main', preserve: true }); globalThis.indexedDB = data; }
    else globalThis.indexedDB = undefined;
    const owner = createRoot(document.body.appendChild(document.createElement('div')));
    await act(async () => { owner.render(React.createElement(Host)); for (let i = 0; i < 3; i++) await turn(); });
    assert.notEqual(mounted.persistence.status, 'loading'); assert.notEqual(mounted.persistence.status, 'ready');
    assert.equal(mounted.messages[0].text, 'Welcome'); assert.doesNotMatch(document.body.textContent, /Chat committed/);
    await act(async () => owner.unmount());
  }
} finally { await vite.close(); window.close(); }
console.log('Scope 7A mounted StrictMode/receipt/conflict/quarantine/unavailable behavior PASS (happy-dom + transactional storage double; no browser durability claim).');
