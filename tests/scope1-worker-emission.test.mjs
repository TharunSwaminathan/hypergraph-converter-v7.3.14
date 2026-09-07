import assert from "node:assert/strict";
import vm from "node:vm";
import { runCustomParser, normalizeCustomParserOutput } from "../src/utils/customParser.js";
import { CUSTOM_PARSER_FEW_SHOTS } from "../src/agent/prompts/customParserFewShots.js";
import { readFileSync } from "node:fs";

// Emulates the Worker transport solely to compile/execute emitted source with
// fresh intrinsics. Real native Worker qualification is scope1-browser.html.
const blobs = new Map();
const original = { Worker: globalThis.Worker, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
URL.createObjectURL = blob => { const id = `test:${blobs.size}`; blobs.set(id, blob); return id; };
URL.revokeObjectURL = id => blobs.delete(id);
globalThis.Worker = class {
  constructor(url) { this.source = blobs.get(url).text(); }
  terminate() {}
  async postMessage(data) {
    try {
      const context = vm.createContext({ console: { log() {}, warn() {} }, data, receive: result => this.onmessage({ data: structuredClone(result) }) });
      vm.runInContext('self = { postMessage: receive };', context);
      new vm.Script(await this.source).runInContext(context, { timeout: 1000 });
      await vm.runInContext('self.onmessage({data})', context, { timeout: 1000 });
    } catch (error) { this.onerror({ message: error.message }); }
  }
};
try {
  const pack = JSON.parse(readFileSync(new URL("./fixtures/scope1-parser-pack.json", import.meta.url), "utf8"));
  for (const example of CUSTOM_PARSER_FEW_SHOTS) {
    const files = pack.filter(f => f.path.startsWith(`${example.id}-`) && !/README|expected/.test(f.path)).map(f => ({ name: f.path.split("/").at(-1), text: f.text }));
    const result = await runCustomParser(example.code, files);
    assert.ok(normalizeCustomParserOutput(result.result).hyperedges.length > 0, example.id);
  }
  const result = await runCustomParser('async function parseHypergraph(files, helpers) { return helpers.parseCSV(files[0].text).map(r => ({id:r.edge, vertices:[r.vertex], weight:1})); }', [{ name: "quoted.csv", text: 'edge,vertex\ne1,"A, B"' }]);
  assert.equal(result.result[0].vertices[0], "A, B");
  assert.equal(blobs.size, 0, "all Worker blob URLs revoked");
} finally {
  globalThis.Worker = original.Worker;
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
}
console.log("Scope 1 emitted Worker syntax, strict function construction, quoted CSV, seven supplied fixtures and URL cleanup passed.");
