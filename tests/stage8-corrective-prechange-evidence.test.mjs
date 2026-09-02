import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  STAGE8_CORRECTIVE_BASELINE_SHA,
  STAGE8_MIXED_REPRESENTATIVE_CASES,
  STAGE8_TRUNCATION_PROBES,
} from "./fixtures/v7.3.14/stage8CorrectiveCorpus.mjs";

const artifact = JSON.parse(await readFile(
  new URL("../artifacts/v7.3.14-stage8-corrective-truncation-prechange.json", import.meta.url),
  "utf8",
));

test("Stage 8 corrective pre-change artifact records the immutable baseline", () => {
  assert.equal(artifact.baselineCommit, STAGE8_CORRECTIVE_BASELINE_SHA);
  assert.equal(artifact.packageVersion, "7.3.13");
  assert.equal(artifact.noStage9Work, true);
});

test("S8-N02 is characterized as a confirmed High authorization-boundary finding", () => {
  assert.deepEqual(artifact.finding, {
    id: "S8-N02",
    severity: "High",
    category: "authorization-boundary safety",
    status: "confirmed",
  });
  assert.equal(artifact.truncation.probeCount, STAGE8_TRUNCATION_PROBES.length);
  assert.ok(artifact.truncation.vulnerableContractCount > 0);
  assert.ok(artifact.truncation.stateChangingHandlersCalled > 0);
});

test("S8-N01 characterization uses independent representative expectations and observes missed clauses", () => {
  assert.equal(artifact.mixedRepresentativePrechange.cases, STAGE8_MIXED_REPRESENTATIVE_CASES.length);
  assert.ok(artifact.mixedRepresentativePrechange.missedAuthorizedClauses > 0);
  for (const record of artifact.mixedRepresentativePrechange.records) {
    assert.equal(typeof record.independentExpectation.executableClause, "string");
    assert.equal(typeof record.independentExpectation.sideEffectScope, "string");
    assert.equal(typeof record.independentExpectation.dispatchRequired, "boolean");
  }
});
