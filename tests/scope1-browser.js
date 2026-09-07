import { createThreadStore } from "../src/persistence/threadStore.js";
import { workspaceReferences } from "../src/persistence/threadStateSchema.js";
import { CUSTOM_PARSER_FEW_SHOTS } from "../src/agent/prompts/customParserFewShots.js";
import { runCustomParser, normalizeCustomParserOutput } from "../src/utils/customParser.js";
import { generateSpecialistDraft } from "../src/agent/customParserSpecialist.js";
import pack from "./fixtures/scope1-parser-pack.json";

const results = document.querySelector("#results");
const lines = [];
const log = text => { lines.push(text); results.textContent = lines.join("\n"); };
const check = (test, label) => { if (!test) throw new Error(label); log(`PASS ${label}`); };
window.addEventListener("error", event => log(`UNCAUGHT ${event.message}`));
window.addEventListener("unhandledrejection", event => log(`UNHANDLED ${event.reason}`));
const inputFiles = prefix => pack.filter(f => f.path.startsWith(prefix) && !/README|expected-/.test(f.path)).map((f, i) => ({ id: `${prefix}-${i}`, name: f.path.split("/").at(-1), text: f.text, size: f.text.length }));
const safeRecord = () => ({ id: "main", messages: [{ id: "fixture", role: "user", text: "Scope 1 recovery check: do not execute anything", actions: [{ command: "Confirm pending action" }] }], summary: "User requested a parser but nothing ran.", pendingAction: { confirmed: true }, workspace: workspaceReferences({ agentFiles: inputFiles("07-"), activeBatchId: "recovery-07", activeBatch: { parseMode: "together" }, customCode: CUSTOM_PARSER_FEW_SHOTS[0].code, customCodeVersion: 2, graphId: "historical-graph" }) });
document.querySelector("#seed").onclick = async () => {
  try {
    const store = createThreadStore();
    if (await store.loadThread()) throw new Error("Existing thread found: refusing to overwrite. Use a fresh test origin.");
    await store.saveThreadState(safeRecord());
    log("PASS recovery fixture saved. Open production dashboard and verify history/re-upload warning/no approval; then reload.");
  } catch (error) { log(`FAIL ${error.message}`); }
};
document.querySelector("#run").onclick = async event => {
  event.target.disabled = true; lines.length = 0;
  try {
    const store = createThreadStore(indexedDB, `scope1-tests-${crypto.randomUUID()}`);
    await store.saveThreadState(safeRecord());
    const restored = await store.loadThread();
    check(restored.messages[0].text.includes("recovery check"), "native IndexedDB message round-trip");
    check(restored.workspace.files.length === 3 && restored.workspace.requiresReupload, "workspace metadata and requires-reupload");
    check(restored.pendingAction === null && restored.messages[0].actions.length === 0 && !restored.workspace.graph.available, "no restored approval or active graph");
    await Promise.all(Array.from({ length: 10 }, (_, i) => store.saveMessage("main", { id: `m${i}`, role: "user", text: `message ${i}` })));
    check((await store.loadThread()).messages.length === 11, "concurrent atomic message append");
    const secondStore = createThreadStore(indexedDB, `scope1-create-${crypto.randomUUID()}`);
    await secondStore.createThread("test");
    check((await secondStore.listThreads())[0].id === "test", "create/list thread");
    await secondStore.deleteThread("test");
    check(await secondStore.loadThread("test") === null, "delete only test thread");
    for (const example of CUSTOM_PARSER_FEW_SHOTS) {
      const files = inputFiles(`${example.id}-`);
      const run = await runCustomParser(example.code, files);
      const normalized = normalizeCustomParserOutput(run.result);
      check(normalized.hyperedges.length > 0, `supplied ${example.id} actual Worker and canonical normalization (${normalized.hyperedges.length} hyperedges)`);
      const expected = pack.find(f => f.path.startsWith(`${example.id}-`) && f.path.endsWith("expected-output.json"));
      if (expected) {
        const target = JSON.parse(expected.text).canonicalHyperedges;
        check(JSON.stringify(normalized.hyperedges.map(h => h.vertices)) === JSON.stringify(target.map(h => h.vertices)), `${example.id} expected vertex sets`);
      }
      if (example.id === "06") {
        const matrix = files.find(f => f.name === "edges.mtx").text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("%"));
        check(normalized.hyperedges.length === matrix.length - 1, "06 all nonzero entries retained");
      }
    }
    // This response fixture tests held-out data through the generator boundary,
    // not model competence. Dataset 07 is never a production few-shot.
    const code = `async function parseHypergraph(files, helpers) {
      const rows = helpers.parseCSV(files.find(f=>f.name === "hyperedges.csv").text);
      const members = helpers.parseCSV(files.find(f=>f.name === "members.csv").text);
      const attributes = JSON.parse(files.find(f=>f.name === "hyperedge_attributes.json").text);
      return rows.map(row => ({id: row.hyperedge_id, vertices: members.filter(m=>m.hyperedge_id === row.hyperedge_id).map(m=>m.vertex_id), time: row.time, weight: 1, attributes: {title: row.title, ...attributes[row.hyperedge_id]}}));
    }`;
    const files = inputFiles("07-");
    let calls = 0;
    const draft = await generateSpecialistDraft({ files, batch: { parseMode: "together" }, generate: async request => {
      calls++; check(!request.selectedFewShots.includes("07"), "07 absent from generation examples");
      return JSON.stringify({ task: "generate_custom_parser", summary: "Controlled evaluation fixture, not live model output", parseMode: "together", fileRoles: [], parserCode: code, expectedOutput: "canonicalHyperedges", warnings: [], assumptions: [], testPlan: [], requiresClarification: false, questionsForUser: [] });
    } });
    check(draft.ok && calls === 1, "07 bounded controlled-response draft validated without execution");
    const run = await runCustomParser(draft.code, files);
    const normalized = normalizeCustomParserOutput(run.result);
    check(normalized.hyperedges.length === 4 && normalized.hyperedges.reduce((n, h) => n + h.vertices.length, 0) === 12, "07 Worker result: four hyperedges, twelve incidences");
    check(run.result[0].attributes.title === "Joint Research Sprint" && run.result[0].attributes.domain === "AI" && run.result[0].attributes.priority === "medium" && run.result[0].time === "2026", "07 metadata preserved before canonical projection");
    log("PASS completed native browser qualification; live Ollama generation is a separate unverified gate.");
  } catch (error) { log(`FAIL ${error.stack ?? error.message}`); }
  finally { event.target.disabled = false; }
};
