import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/DeterministicCommandHelp.jsx", import.meta.url), "utf8");

assert.match(source, /<summary\b/, "Help details must keep native summary disclosure controls");
assert.doesNotMatch(source, /<summary[^>]*tabIndex=\{-1\}/, "summary controls must not be removed from keyboard tab order");
assert.doesNotMatch(source, /<summary[^>]*tabIndex="-1"/, "summary controls must not use string tabIndex -1 either");
assert.match(source, /aria-label=\{`Try this command:/, "Try buttons need command-specific labels");
assert.match(source, /aria-label=\{`Copy command:/, "Copy buttons need command-specific labels");
assert.match(source, /aria-label=\{`Copy deep link for/, "Deep-link buttons need command-specific labels");

console.log("deterministic Help keyboard accessibility tests passed.");
