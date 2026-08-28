import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIncidenceIndex,
  getHyperedgeVertexIds,
  getIncidentHyperedgeIds,
  hasHyperedge,
  hasVertex,
} from "../src/graph/incidenceIndex.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage3-corrective-oracle.json"));

const source = [{
  id: "h",
  vertices: ["a", "b"],
  time: 0,
  weight: 0,
  attributes: { source: "canonical" },
}];
const freshIndex = () => buildIncidenceIndex(source);
const queriesWork = index => hasHyperedge(index, "h")
  && hasVertex(index, "a")
  && same(getIncidentHyperedgeIds(index, "a"), ["h"])
  && same(getHyperedgeVertexIds(index, "h"), ["a", "b"]);

const prototypeResults = [];
for (const operation of [Object.setPrototypeOf, Reflect.setPrototypeOf]) {
  for (const descriptor of [
    { name: "hyperedgesById", get: index => index.hyperedgesById, prototype: Map.prototype },
    { name: "vertexToHyperedges", get: index => index.vertexToHyperedges, prototype: Map.prototype },
    { name: "hyperedgeToVertices", get: index => index.hyperedgeToVertices, prototype: Map.prototype },
    { name: "vertexToHyperedges[a]", get: index => index.vertexToHyperedges.get("a"), prototype: Set.prototype },
    { name: "hyperedgeToVertices[h]", get: index => index.hyperedgeToVertices.get("h"), prototype: Set.prototype },
  ]) {
    const index = freshIndex();
    const collection = descriptor.get(index);
    const before = Object.getPrototypeOf(collection) === descriptor.prototype;
    const error = captureError(() => operation(collection, null));
    const after = Object.getPrototypeOf(collection) === descriptor.prototype;
    prototypeResults.push({
      operation: operation === Object.setPrototypeOf ? "Object.setPrototypeOf" : "Reflect.setPrototypeOf",
      collection: descriptor.name,
      readOnlyTypeError: error?.name === "TypeError" && /read-only/i.test(error.message),
      prototypeUnchanged: before && after,
      queriesWorkAfterAttempt: queriesWork(index),
    });
  }
}

const bypassIndex = freshIndex();
const mapBypass = captureError(() => Map.prototype.set.call(bypassIndex.hyperedgesById, "new", source[0]));
const setBypass = captureError(() => Set.prototype.add.call(bypassIndex.hyperedgeToVertices.get("h"), "new"));
const sourceCode = await readFile(join(projectRoot, "src", "graph", "incidenceIndex.js"), "utf8");

const checks = [
  {
    id: "S3-N01",
    title: "Read-only incidence collections reject prototype mutation without query damage",
    fixed: prototypeResults.length === 10
      && prototypeResults.every(result => result.readOnlyTypeError && result.prototypeUnchanged && result.queriesWorkAfterAttempt),
    evidence: prototypeResults,
  },
  {
    id: "S3-N01-NATIVE-MUTATOR-BYPASS",
    title: "Native Map/Set mutators cannot operate on the collection proxies",
    fixed: mapBypass?.name === "TypeError" && setBypass?.name === "TypeError" && queriesWork(bypassIndex),
    evidence: { mapBypass: mapBypass?.message, setBypass: setBypass?.message },
  },
  {
    id: "S3-CANONICAL-REFERENCE-POLICY",
    title: "Read-only topology retains the original canonical hyperedge record reference",
    fixed: bypassIndex.hyperedgesById.get("h") === source[0],
    evidence: { sameReference: bypassIndex.hyperedgesById.get("h") === source[0] },
  },
  {
    id: "S3-CORRECTIVE-SOURCE-SCOPE",
    title: "Corrective remains a local proxy hardening with no projection dependency",
    fixed: /setPrototypeOf\(\)\s*{\s*throw new TypeError\(`\$\{label\} is read-only\.\`\);\s*}/m.test(sourceCode)
      && !/from\s+["'][^"']*(?:projection|mappings|graphModel)[^"']*["']/i.test(sourceCode),
    evidence: { setPrototypeOfTrapCount: (sourceCode.match(/setPrototypeOf\(\)/g) ?? []).length },
  },
];

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 3,
  corrective: "S3-N01",
  severity: "Medium",
  status: fixedCount === checks.length ? "fixed" : "unresolved",
  parentCommit: "a2de8d8ed81b568b30d59ecbbbb367d13771ebb9",
  fixedCount,
  total: checks.length,
  environment: { runtime: process.version, platform: `${process.platform}/${process.arch}` },
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log(`Stage 3 corrective oracle: ${fixedCount}/${checks.length} families passed.`);
console.log(`Evidence: ${outputPath}`);
for (const check of checks) console.log(`${check.fixed ? "PASS" : "FAIL"} ${check.id} — ${check.title}`);
if (fixedCount !== checks.length) process.exitCode = 1;

function captureError(operation) {
  try {
    operation();
    return null;
  } catch (error) {
    return { name: error?.name ?? "Error", message: error?.message ?? String(error) };
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
