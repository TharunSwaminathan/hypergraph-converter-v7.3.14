import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateCommandReferenceMarkdown } from "../src/agent/deterministicNlu/commandCatalogFormatter.js";

const outputPath = resolve("docs/DETERMINISTIC_COMMAND_REFERENCE.md");
writeFileSync(outputPath, generateCommandReferenceMarkdown(), "utf8");
console.log(`Generated ${outputPath}`);
