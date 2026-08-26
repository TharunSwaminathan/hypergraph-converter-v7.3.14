import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { normalizeEmbeddedCommand, runReadOnlySafetyMatrix, stateChangingCatalogExamples } from "./deterministicSafetyMatrix.mjs";
import { V7_3_12_READONLY_FRAMES } from "./verify-v7-3-12-readonly-safety.mjs";

const normalize = normalizeEmbeddedCommand;

export const V7_3_13_ADDED_READONLY_FRAMES = Object.freeze({
  curious_means: command => `I'm curious what ${normalize(command)} means.`,
  clarify_meaning: command => `Clarify the meaning of: ${command}`,
  background_command: command => `Give me background on the command: ${command}`,
  reviewing_not_authorizing: command => `I am reviewing this command, not authorizing it: ${command}`,
  leave_unchanged: command => `Leave everything unchanged; ${command}`,
  keep_graph_exact: command => `Keep the graph exactly as it is; ${command}`,
  discussion_not_execution: command => `This is for discussion, not execution: ${command}`,
  considering: command => `I am considering ${normalize(command)}; tell me about it.`,
  before_authorize: command => `Before I authorize anything, explain ${normalize(command)}.`,
  havent_authorized: command => `I haven't authorized ${normalize(command)}; explain it.`,
});

export const V7_3_13_READONLY_FRAMES = Object.freeze({
  ...V7_3_12_READONLY_FRAMES,
  ...V7_3_13_ADDED_READONLY_FRAMES,
});

export function runV7313ReadOnlySafetyMatrix() {
  return runReadOnlySafetyMatrix(V7_3_13_READONLY_FRAMES);
}

export function v7313PositiveActionCorpus() {
  return stateChangingCatalogExamples();
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const outputPath = resolve(process.argv[2] ?? "artifacts/v7.3.13-safety-results.json");
  const report = await runV7313ReadOnlySafetyMatrix();
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, allFailures: report.allFailures.slice(0, 20) }, null, 2));
}
