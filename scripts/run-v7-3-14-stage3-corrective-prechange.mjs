import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIncidenceIndex,
  getHyperedgeVertexIds,
  hasHyperedge,
} from "../src/graph/incidenceIndex.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage3-corrective-prechange.json"));

const source = [{
  id: "h",
  vertices: ["a", "b"],
  time: null,
  weight: 1,
  attributes: {},
}];

const topLevelIndex = buildIncidenceIndex(source);
const topLevelCollection = topLevelIndex.hyperedgesById;
const topLevelBefore = Object.getPrototypeOf(topLevelCollection) === Map.prototype;
let topLevelMutationSucceeded = false;
let topLevelQueryAfterMutation;
try {
  Object.setPrototypeOf(topLevelCollection, null);
  topLevelMutationSucceeded = Object.getPrototypeOf(topLevelCollection) === null;
} catch (error) {
  topLevelMutationSucceeded = false;
  topLevelQueryAfterMutation = errorMessage(error);
}
if (topLevelQueryAfterMutation === undefined) {
  try {
    topLevelQueryAfterMutation = hasHyperedge(topLevelIndex, "h");
  } catch (error) {
    topLevelQueryAfterMutation = errorMessage(error);
  }
}

const nestedIndex = buildIncidenceIndex(source);
const nestedCollection = nestedIndex.hyperedgeToVertices.get("h");
const nestedBefore = Object.getPrototypeOf(nestedCollection) === Set.prototype;
let nestedMutationSucceeded = false;
let nestedQueryAfterMutation;
try {
  Object.setPrototypeOf(nestedCollection, null);
  nestedMutationSucceeded = Object.getPrototypeOf(nestedCollection) === null;
} catch (error) {
  nestedMutationSucceeded = false;
  nestedQueryAfterMutation = errorMessage(error);
}
if (nestedQueryAfterMutation === undefined) {
  try {
    nestedQueryAfterMutation = getHyperedgeVertexIds(nestedIndex, "h");
  } catch (error) {
    nestedQueryAfterMutation = errorMessage(error);
  }
}

const artifact = {
  stage: 3,
  corrective: "S3-N01",
  kind: "pre_fix_characterization",
  parentCommit: "a2de8d8ed81b568b30d59ecbbbb367d13771ebb9",
  expectedVulnerabilityObserved: topLevelBefore
    && topLevelMutationSucceeded
    && typeof topLevelQueryAfterMutation === "string"
    && nestedBefore
    && nestedMutationSucceeded
    && typeof nestedQueryAfterMutation === "string",
  topLevelMap: {
    prototypeInitiallyMapPrototype: topLevelBefore,
    objectSetPrototypeOfSucceeded: topLevelMutationSucceeded,
    prototypeBecameNull: Object.getPrototypeOf(topLevelCollection) === null,
    queryAfterMutation: topLevelQueryAfterMutation,
  },
  nestedSet: {
    prototypeInitiallySetPrototype: nestedBefore,
    objectSetPrototypeOfSucceeded: nestedMutationSucceeded,
    prototypeBecameNull: Object.getPrototypeOf(nestedCollection) === null,
    queryAfterMutation: nestedQueryAfterMutation,
  },
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log(`Stage 3 corrective pre-fix characterization: ${artifact.expectedVulnerabilityObserved ? "VULNERABILITY REPRODUCED" : "NOT REPRODUCED"}.`);
console.log(`Evidence: ${outputPath}`);
if (!artifact.expectedVulnerabilityObserved) process.exitCode = 1;

function errorMessage(error) {
  return `${error?.name ?? "Error"}: ${error?.message ?? String(error)}`;
}
