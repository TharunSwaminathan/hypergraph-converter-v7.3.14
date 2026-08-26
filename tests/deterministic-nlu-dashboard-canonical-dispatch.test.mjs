import assert from "node:assert/strict";
import { resolveCanonicalControlPlan } from "../src/agent/deterministicControlPlanner.js";

const stats = resolveCanonicalControlPlan("NAVIGATE_STATS", {}, { hasGraph: true });
assert.equal(stats.kind, "show_stats");
assert.equal(stats.canonicalPlanner, "dashboard_control_v1");

const route = resolveCanonicalControlPlan("SET_INPUT_ROUTE", { route: "CSR" }, { hasGraph: false, fmt: "simple", agentFileCount: 0 });
assert.equal(route.kind, "switch_route");
assert.equal(route.formatId, "csr_json");

const visual = resolveCanonicalControlPlan("SET_VISUAL_LIMIT", { visualLimit: 100 }, { vizLimit: 50 });
assert.equal(visual.kind, "set_visual_limit");
assert.equal(visual.value, 100);

console.log("deterministic NLU dashboard canonical dispatch tests passed.");
