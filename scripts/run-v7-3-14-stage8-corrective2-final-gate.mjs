import { writeFile } from "node:fs/promises";
import { CORRECTIVE2_PARENT, runFinalGateMatrix } from "./stage8Corrective2Harness.mjs";

const matrix = await runFinalGateMatrix();
const output = {
  stage: 8,
  corrective: 2,
  kind: "postchange_final_gate_adversarial_matrix",
  parentCommit: CORRECTIVE2_PARENT,
  packageVersion: "7.3.13",
  noStage9Work: true,
  invariant: "Only an actual/declared class match with positive authorization for the actual class and executable request semantics may reach a state-changing handler.",
  matrix,
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective2-final-gate.json",
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(JSON.stringify({
  cases: matrix.cases,
  expectedExecutions: matrix.expectedExecutions,
  actualExecutions: matrix.actualExecutions,
  violations: matrix.violations,
  mismatchBlocks: matrix.mismatchBlocks,
  missingSemanticsBlocks: matrix.missingSemanticsBlocks,
  truncatedBlocks: matrix.truncatedBlocks,
}, null, 2));

if (matrix.violations !== 0) process.exitCode = 1;
