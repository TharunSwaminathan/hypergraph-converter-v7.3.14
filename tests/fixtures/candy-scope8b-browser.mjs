// Guarded test entry only. The imported qualified harness refuses real profiles.
import "./candy-scope8a-browser.mjs";
import { createProjectStore } from "../../src/persistence/projectStore.js";
const store = createProjectStore(), pause = ms => new Promise(resolve => setTimeout(resolve, ms ?? 30));
const panel = () => document.querySelector('.analysis-history'), button = (label, node = document) => [...node.querySelectorAll('button')].find(x => x.textContent === label), check = (x, msg) => { if (!x) throw Error(msg); };
async function wait(fn, label) { for (let n = 0; n < 1500; n++) { const value = await fn(); if (value) return value; await pause(); } throw Error('Timeout ' + label + ': ' + document.body.textContent.slice(-1800)); }
let boundary = null, releaseDigest = null;
const put = IDBObjectStore.prototype.put, transaction = IDBDatabase.prototype.transaction, complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete'), digest = crypto.subtle.digest.bind(crypto.subtle);
function hold(stage) { console.log('S8A_BOUNDARY:' + stage); const until = Date.now() + 45000; while (Date.now() < until) {} throw Error('Owned bounded crash hook was not interrupted'); }
IDBObjectStore.prototype.put = function(value, ...args) { if (boundary === 'before-history' && this.name === 'analysisHistories') { boundary = null; hold('before-history-publication'); } return put.call(this, value, ...args); };
IDBDatabase.prototype.transaction = function(names, mode, ...args) { const tx = transaction.call(this, names, mode, ...args); if (boundary === 'after-history' && mode === 'readwrite' && [...tx.objectStoreNames].includes('analysisHistories') && ![...tx.objectStoreNames].includes('workspaceObjects')) { boundary = null; Object.defineProperty(tx, 'oncomplete', { configurable: true, get() { return complete.get.call(tx); }, set(fn) { complete.set.call(tx, function(event) { hold('after-history-commit-before-receipt'); fn?.call(tx, event); }); } }); } return tx; };
crypto.subtle.digest = async function(algorithm, data) { const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data); if (boundary === 'delay-history' && new TextDecoder().decode(bytes).includes('"analysisType"')) { boundary = null; console.log('S8B_HISTORY_PREPARE_PAUSED'); return new Promise((resolve, reject) => { releaseDigest = () => { releaseDigest = null; digest(algorithm, data).then(resolve, reject); }; }); } return digest(algorithm, data); };
async function currentId() { await wait(() => panel()?.dataset.historyProject, 'mounted history owner'); return panel().dataset.historyProject; }
async function history(id) { const owner = id ?? await currentId(), data = await store.readAnalysisHistory(owner); return { projectId: owner, projectRevision: data.manifest.revision, records: data.envelope?.records ?? [], seen: data.envelope?.seen.length ?? 0, envelopeSha256: data.envelope?.sha256 ?? null }; }
async function readyHistory() { await wait(() => panel() && ['ready', 'error'].includes(panel().dataset.historyStatus), 'history discovery'); return history(); }
async function runCpu(algorithm = 'Breadth-First Search', saved = true) {
  document.getElementById('tools-tab-algorithms').click(); await readyHistory(); const before = await history(), tools = document.getElementById('tools-panel-algorithms'); const pill = [...tools.querySelectorAll('button')].find(x => x.textContent.startsWith(algorithm)); check(pill, 'algorithm pill'); pill.click(); await pause(); button('Run', tools).click();
  if (saved) await wait(async () => panel().dataset.historyStatus === 'ready' && (await history()).records.length === before.records.length + 1, 'committed CPU history');
  else await wait(() => panel().dataset.historyStatus === 'error', 'truthful failed history receipt');
  return { before, after: await history(), status: panel().dataset.historyStatus, message: panel().textContent };
}
async function inspect(index = 0) { document.getElementById('tools-tab-algorithms').click(); const row = [...panel().querySelectorAll('.analysis-history__list button')][index]; check(row, 'history entry'); row.click(); await wait(() => panel().querySelector('[aria-label="Historical outcome"]'), 'historical outcome'); return { text: panel().textContent, outcome: panel().querySelector('[aria-label="Historical outcome"]').textContent, images: panel().querySelectorAll('img').length }; }
async function reviewClear() { document.getElementById('tools-tab-algorithms').click(); button('Clear project analysis history…', panel()).click(); await wait(() => document.querySelector('dialog[open]'), 'history clear review'); check(document.activeElement.textContent === 'Cancel', 'Cancel-first focus'); }
async function finishReview(accept) { const dialog = document.querySelector('dialog[open]'); button(accept ? 'Confirm' : 'Cancel', dialog).click(); await pause(200); return { text: panel().textContent, history: await history() }; }
window.s8b = { ...window.s8a, ready: true, currentId, history, readyHistory, runCpu, inspect, reviewClear, finishReview,
  async state() { return { ...await window.s8a.state(), history: await history(), historyStatus: panel().dataset.historyStatus, historyMessage: panel().textContent, liveOutcome: document.querySelector('[aria-label="Validated hypergraph motif result"]')?.textContent ?? null }; },
  async rerun() { const before = await history(); button('Rerun on matching current input', panel()).click(); await wait(async () => panel().dataset.historyStatus === 'ready' && (await history()).records.length === before.records.length + 1, 'fresh intentional rerun'); return history(); },
  async deleteOne(accept = true) { const before = await history(); button('Delete historical result…', panel()).click(); await wait(() => document.querySelector('dialog[open]'), 'history delete review'); check(document.activeElement.textContent === 'Cancel', 'Cancel-first focus'); await finishReview(accept); if (accept) await wait(async () => (await history()).records.length === before.records.length - 1, 'history deletion commit'); return history(); },
  async clear(accept = true) { await reviewClear(); await finishReview(accept); if (accept) await wait(async () => (await history()).records.length === 0 || panel().dataset.historyStatus === 'error', 'history clear result'); return history(); },
  armHistory: mode => { boundary = mode; },
  async beginCpu() { document.getElementById('tools-tab-algorithms').click(); button('Run', document.getElementById('tools-panel-algorithms')).click(); return true; },
  async waitPaused() { await wait(() => releaseDigest, 'delayed history hash'); return true; }, releaseHistory: () => { releaseDigest?.(); return true; },
  async reloadPageState() { await window.s8a.mount(); await window.s8a.readyApp(); await readyHistory(); return history(); },
};
console.log('S8B_PAGE_READY');
