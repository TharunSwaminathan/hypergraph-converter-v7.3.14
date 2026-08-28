import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildH2H, expH2H, expH2HResult } from "../src/utils/mappings.js";

const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const valid = expH2HResult(buildH2H([edge("h1"), edge("h2")]));
assert.equal(valid.ok, true);
assert.equal(valid.reason, null);
assert.match(valid.text, /^h1: h2\[shared: shared\]/);
assert.equal(expH2H(buildH2H([edge("h1"), edge("h2")])), valid.text, "string compatibility wrapper");

const invalid = expH2HResult(buildH2H([edge("edge:colon"), edge("other")]));
assert.equal(invalid.ok, false);
assert.match(invalid.reason, /unrepresentable hyperedge identifier/i);
assert.match(invalid.text, /^# H2H export not generated\./);
assert.equal(invalid.assessment.ok, false);

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const downloadStart = appSource.indexOf("function downloadExportForAgent");
const downloadEnd = appSource.indexOf("function downloadCurrentExport", downloadStart);
const downloadBody = appSource.slice(downloadStart, downloadEnd);
assert.ok(downloadStart >= 0 && downloadEnd > downloadStart);
assert.match(appSource, /expH2HResult/);
assert.match(appSource, /result:\s*\(\)\s*=>\s*h2hExportResult/);
assert.match(downloadBody, /if\s*\(!resolved\.ok\)\s*return\s*\{\s*ok:\s*false/);
assert.ok(
  downloadBody.indexOf("if (!resolved.ok)") < downloadBody.indexOf("dl(selected.fn"),
  "refusal must return before the downloader call",
);
assert.doesNotMatch(downloadBody.match(/if \(!resolved\.ok\)[^\n]*/)?.[0] ?? "", /filename/);
assert.match(appSource, /function downloadCurrentExport\(\)/);
assert.doesNotMatch(appSource, /onClick=\{\(\)\s*=>\s*dl\(curExp\.fn,\s*exportContent\)\}/);
assert.match(appSource, /onClick=\{downloadCurrentExport\}/);

console.log("v7.3.14 Stage 2 corrective #2 truthful H2H download contract passed.");
