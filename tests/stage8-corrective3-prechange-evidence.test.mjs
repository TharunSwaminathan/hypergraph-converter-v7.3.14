import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = JSON.parse(await readFile(
  new URL("../artifacts/v7.3.14-stage8-corrective3-prechange.json", import.meta.url),
  "utf8",
));
const records = Object.fromEntries(artifact.records.map(record => [record.id, record]));

test("Stage 8 corrective #3 pre-change evidence is pinned to the authoritative parent", () => {
  assert.equal(artifact.parentCommit, "6b0af8a8a33e5dccc0a9cb7f336d82e1bddaa1e7");
  assert.equal(artifact.packageVersion, "7.3.13");
  assert.equal(artifact.noStage9Work, true);
});

test("S8-N05 pre-change evidence records domain and typed-kind dispatch confusion", () => {
  const finding = artifact.findings.find(item => item.id === "S8-N05");
  assert.equal(finding.severity, "High");
  assert.equal(finding.status, "confirmed");
  assert.equal(records["S8-N05-A-domain-graph-kind-dashboard-payload-graph"].actualSideEffectClass, "read_only");
  assert.equal(records["S8-N05-A-domain-graph-kind-dashboard-payload-graph"].handlerCalls.graphMutation, 1);
  assert.equal(records["S8-N05-B-domain-graph-kind-grounded-payload-graph"].handlerCalls.graphMutation, 0);
  assert.equal(records["S8-N05-B-domain-graph-kind-grounded-payload-graph"].handlerCalls.groundedQuestion, 1);
  assert.equal(records["S8-N05-C-domain-dashboard-kind-graph"].protectedHandlerCalls, 1);
  assert.equal(records["S8-N05-D-domain-mapping-kind-parser"].protectedHandlerCalls, 1);
  assert.equal(records["S8-N05-E-domain-parser-kind-mapping"].protectedHandlerCalls, 1);
  assert.equal(records["S8-N05-F-domain-legacy-kind-dashboard"].protectedHandlerCalls, 1);
});

test("S8-N06 pre-change evidence records a legacy action self-declared as read-only", () => {
  const finding = artifact.findings.find(item => item.id === "S8-N06");
  assert.equal(finding.severity, "High");
  assert.equal(finding.status, "confirmed");
  const record = records["S8-N06-known-file-picker-self-declares-read-only"];
  assert.equal(record.actualSideEffectClass, "read_only");
  assert.equal(record.handlerCalls.legacyAction, 1);
  assert.equal(record.protectedStateChanged, true);
});
