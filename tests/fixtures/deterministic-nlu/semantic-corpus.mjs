import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deterministicNluCoreRegressions } from "./core-regressions.mjs";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

export const HELDOUT_FIXTURE_FILES = Object.freeze([
  "dataset-mapping-actions.heldout.jsonl",
  "dataset-mapping-questions.heldout.jsonl",
  "dataset-grouping-actions.heldout.jsonl",
  "dataset-grouping-questions.heldout.jsonl",
  "graph-mutation-actions.heldout.jsonl",
  "graph-mutation-questions.heldout.jsonl",
  "parser-workflow.heldout.jsonl",
  "dashboard-control.heldout.jsonl",
  "corrections.heldout.jsonl",
  "negative-ambiguous-adversarial.heldout.jsonl",
]);

export function loadHeldoutFixtures() {
  return HELDOUT_FIXTURE_FILES.flatMap(fileName => {
    const raw = readFileSync(join(fixtureDir, fileName), "utf8").trim();
    if (!raw) return [];
    return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  });
}

export const deterministicNluHeldoutCorpus = loadHeldoutFixtures();
export const deterministicNluSemanticCorpus = [
  ...deterministicNluCoreRegressions,
  ...deterministicNluHeldoutCorpus,
];
