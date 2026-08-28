import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as mappingExports from "../src/utils/mappings.js";
import { DERIVED_STATUS } from "../src/utils/derivedResults.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.doesNotMatch(
  appSource,
  /h2hResult\.status\s*===\s*DERIVED_STATUS\.COMPUTED\s*\?\s*expH2HResult\(h2h\)\s*:\s*null/,
  "H2H availability must never fall through through a null structured result",
);
assert.match(appSource, /result:\s*\(\)\s*=>\s*h2hExportResult/);

assert.equal(typeof mappingExports.expH2HAvailabilityResult, "function");
const { buildH2H, expH2HAvailabilityResult } = mappingExports;
const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const computed = expH2HAvailabilityResult(
  buildH2H([edge("h1"), edge("h2")]),
  { status: DERIVED_STATUS.COMPUTED },
);
assert.equal(computed.ok, true);
assert.equal(computed.status, DERIVED_STATUS.COMPUTED);
assert.match(computed.text, /^h1: h2\[shared: shared\]/);

const unrepresentable = expH2HAvailabilityResult(
  buildH2H([edge("edge:colon"), edge("other")]),
  { status: DERIVED_STATUS.COMPUTED },
);
assert.equal(unrepresentable.ok, false);
assert.match(unrepresentable.reason, /unrepresentable hyperedge identifier/i);

const overBudget = expH2HAvailabilityResult([], {
  status: DERIVED_STATUS.OVER_BUDGET,
  reason: "H2H projection exceeds the configured safety budget.",
});
assert.equal(overBudget.ok, false);
assert.equal(overBudget.status, DERIVED_STATUS.OVER_BUDGET);
assert.match(overBudget.reason, /safety budget/);
assert.match(overBudget.text, /^# H2H projection not computed\./);

const notRequested = expH2HAvailabilityResult([], {
  status: DERIVED_STATUS.NOT_REQUESTED,
  reason: "Open the Mappings tab to request it.",
});
assert.equal(notRequested.ok, false);
assert.equal(notRequested.status, DERIVED_STATUS.NOT_REQUESTED);
assert.match(notRequested.text, /^# H2H projection not computed\./);

const downloadStart = appSource.indexOf("function downloadExportForAgent");
const downloadEnd = appSource.indexOf("function downloadCurrentExport", downloadStart);
const downloadBody = appSource.slice(downloadStart, downloadEnd);
assert.ok(downloadStart >= 0 && downloadEnd > downloadStart);
assert.match(downloadBody, /if\s*\(!resolved\.ok\)\s*return\s*\{\s*ok:\s*false/);
assert.ok(downloadBody.indexOf("if (!resolved.ok)") < downloadBody.indexOf("dl(selected.fn"));
assert.doesNotMatch(downloadBody.match(/if \(!resolved\.ok\)[^\n]*/)?.[0] ?? "", /filename/);

console.log("v7.3.14 Stage 2 final corrective explicit H2H availability passed.");
