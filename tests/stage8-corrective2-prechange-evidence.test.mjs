import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = JSON.parse(await readFile(
  new URL("../artifacts/v7.3.14-stage8-corrective2-prechange.json", import.meta.url),
  "utf8",
));

const records = Object.fromEntries(artifact.records.map(record => [record.id, record]));

test("Stage 8 corrective #2 pre-change evidence is pinned to the authoritative parent", () => {
  assert.equal(artifact.parentCommit, "ea6c442b5219f7452fd1dc32663cec580790911e");
  assert.equal(artifact.packageVersion, "7.3.13");
  assert.equal(artifact.noStage9Work, true);
});

test("S8-N03 pre-change evidence records plan/scope authorization bypasses", () => {
  const finding = artifact.findings.find(item => item.id === "S8-N03");
  assert.equal(finding.severity, "High");
  assert.equal(finding.status, "confirmed");
  assert.equal(records["S8-N03-A-navigation-auth-graph-plan-declared-read-only"].handlerCalls.graphMutation, 1);
  assert.equal(records["S8-N03-B-navigation-auth-graph-plan-declared-navigation"].handlerCalls.graphMutation, 1);
  assert.equal(records["S8-N03-C-graph-auth-dashboard-plan-declared-graph"].handlerCalls.dashboardControl, 1);
  assert.equal(records["S8-N03-D-mapping-auth-graph-plan-declared-mapping"].handlerCalls.graphMutation, 1);
  assert.equal(records["S8-N03-E-truncated-graph-plan-declared-read-only"].handlerCalls.graphMutation, 1);
  assert.equal(records["S8-N03-F-read-only-auth-graph-plan-declared-read-only"].handlerCalls.graphMutation, 0);
});

test("S8-N04 pre-change evidence records the empty-query no-semantics bypass", () => {
  const finding = artifact.findings.find(item => item.id === "S8-N04");
  assert.equal(finding.severity, "Medium");
  assert.equal(finding.status, "confirmed");
  const record = records["S8-N04-empty-query-no-semantics-state-changing-plan"];
  assert.equal(record.prepared.requestSemanticsPresent, false);
  assert.equal(record.handlerCalls.graphMutation, 1);
  assert.equal(record.stateChanged, true);
});
