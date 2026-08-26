import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/AdvancedOptionsPanel.jsx", import.meta.url), "utf8");

assert.match(app, /const batchPreviewActive = Boolean/);
assert.match(app, /function previewBatchUpdatesForAgent/);
assert.match(app, /function discardBatchPreviewForAgent/);
assert.match(app, /blockedByBatchPreview/);
assert.match(app, /previewBatchUpdates: previewBatchUpdatesForAgent/);
assert.match(app, /discardBatchPreview: discardBatchPreviewForAgent/);

assert.match(panel, /Preview Batch Changes/);
assert.match(panel, /Commit Batch Changes/);
assert.match(panel, /Discard Preview/);
assert.match(panel, /conversational graph edits are paused/);

console.log("batch preview guard tests v7.3.6 passed.");
