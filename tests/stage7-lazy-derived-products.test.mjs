import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { buildMappingPresentation, MAPPING_DISPLAY_LIMITS } from "../src/derived/mappingPresentation.js";
import {
  shouldRequestCSR,
  shouldRequestH2V,
  shouldRequestMatrix,
  shouldRequestV2H,
} from "../src/utils/derivedRequests.js";

const cache = createDerivedProductCache();
const graphA = {};
const graphB = {};
cache.activateGraph(7, graphA);
const calls = { h2v: 0, v2h: 0, csr: 0, export: 0 };

assert.equal(cache.getOrCompute("h2v", {}, () => { calls.h2v += 1; return ["h2v"]; })[0], "h2v");
assert.equal(cache.getOrCompute("h2v", {}, () => { calls.h2v += 1; return ["wrong"]; })[0], "h2v");
assert.deepEqual(calls, { h2v: 1, v2h: 0, csr: 0, export: 0 });
cache.getOrCompute("export_text:h2v", {}, () => { calls.export += 1; return "exact"; });
assert.equal(calls.export, 1);

cache.setCompleteForGraph(7, graphA, "v2v", {}, { status: "over_budget", value: null });
cache.setCompleteForGraph(7, graphA, "matrix", {}, { status: "cancelled", value: null });
cache.setCompleteForGraph(7, graphA, "h2h", {}, { status: "error", value: null });
assert.equal(cache.getSnapshot().refusedWrites, 3);
assert.equal(cache.getSnapshot().entryCount, 2);

cache.activateGraph(8, graphB);
assert.equal(cache.getSnapshot().entryCount, 0);
assert.equal(cache.peek("h2v", {}), undefined);

const defaultContext = { activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" };
assert.equal(shouldRequestH2V(defaultContext), true);
assert.equal(shouldRequestV2H(defaultContext), false);
assert.equal(shouldRequestCSR(defaultContext), false);
assert.equal(shouldRequestMatrix(defaultContext), false);
assert.equal(shouldRequestV2H({ ...defaultContext, selectedMappingId: "v2h" }), true);
assert.equal(shouldRequestCSR({ ...defaultContext, activeSection: "export", expId: "csr_csv" }), true);
assert.equal(shouldRequestMatrix({ ...defaultContext, activeSection: "export", expId: "matrix" }), true);

const largeH2V = Array.from({ length: 10_000 }, (_, index) => ({
  hid: index === 0 ? 0 : `h${index}`,
  vertices: index === 1 ? ["null", "__proto__", "東京"] : [`v${index}`],
  time: null,
  weight: index === 2 ? 0 : 1,
}));
const presentation = buildMappingPresentation("h2v", largeH2V);
assert.equal(presentation.rows.length, MAPPING_DISPLAY_LIMITS.rows);
assert.equal(presentation.totalRows, 10_000);
assert.equal(presentation.complete, false);
assert.equal(presentation.rows[0][0], 0);
assert.equal(presentation.rows[1][2], "null, __proto__, 東京");
assert.equal(presentation.rows[2][3], 0);
assert.ok(presentation.text.length <= MAPPING_DISPLAY_LIMITS.previewCharacters + largeH2V[0].vertices[0].length + 50);

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const vizSource = readFileSync(new URL("../src/components/Viz.jsx", import.meta.url), "utf8");
assert.doesNotMatch(appSource, /const h2v = useMemo\(\(\) => finalHes \? buildH2V/);
assert.doesNotMatch(appSource, /const v2h = useMemo\(\(\) => finalHes \? buildV2H/);
assert.doesNotMatch(appSource, /const csr = useMemo\(\(\) => finalHes \? buildCSR/);
assert.doesNotMatch(appSource, /const h2vRows = h2v\.map/);
assert.doesNotMatch(appSource, /const v2hRows = v2h\.map/);
assert.match(appSource, /activeSection === "export"\s*\? resolveExport/);
assert.equal((appSource.match(/<MappingBox/g) ?? []).length, 1);
assert.doesNotMatch(vizSource, /operationType:\s*DERIVED_OPERATIONS\.LINE_GRAPH,[\s\S]{0,100}options:\s*\{\s*vizLimit/);

console.log("Stage 7 lazy derived-product, cache invalidation, and bounded presentation gates passed.");
