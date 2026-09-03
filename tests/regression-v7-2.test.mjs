import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFile(join(root, path), "utf8");

const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.14");

const app = await read("src/App.jsx");
assert.doesNotMatch(app, /setGraphVersion/);
assert.match(app, /commitGraph/);
assert.match(app, /prepareGraphMutationForAgent/);
assert.match(app, /graphFingerprint/);
assert.match(app, /parserProfiles/);

const chat = await read("src/components/AgentChatPanel.jsx");
assert.match(chat, /maybeStageGraphMutation/);
assert.match(chat, /createConfirmationSnapshot\("apply_graph_mutation"/);
assert.match(chat, /mutationPlanHash/);

const sandbox = await read("src/utils/customParser.js");
assert.match(sandbox, /validateParserCodeSafety/);
assert.match(sandbox, /Blocked API inside custom parser trusted-code guard/);
assert.match(sandbox, /maxIncidences/);

const docs = [
  "docs/V7_2_BASELINE_AUDIT.md",
  "docs/GRAPH_MUTATION_ARCHITECTURE.md",
  "docs/GRAPH_MUTATION_SCHEMA.md",
  "docs/CUSTOM_PARSER_CONVERSATION.md",
  "docs/PARSER_PROFILE_SCHEMA.md",
  "docs/V7_2_MIGRATION.md",
  "docs/V7_2_TEST_REPORT.md",
  "docs/V7_2_KNOWN_LIMITATIONS.md",
];
for (const doc of docs) assert.equal(existsSync(join(root, doc)), true, `${doc} must exist`);

console.log("v7.2 regression source tests passed.");
