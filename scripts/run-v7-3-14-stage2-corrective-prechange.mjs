import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildH2H, expH2H } from "../src/utils/mappings.js";
import { autoDetect, parseCSVFmt, parseH2HText } from "../src/utils/parsers.js";

const EXPECTED_PARENT = "f2f5da21bee2db4ac4bb0e133779c10e2829de13";
const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
if (head !== EXPECTED_PARENT) throw new Error(`This historical characterization only runs at ${EXPECTED_PARENT}; current HEAD is ${head}.`);

const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });
const capture = operation => {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
};
const characterizeEdgeId = id => {
  const exported = expH2H(buildH2H([edge(id), edge("other")]));
  const parsed = capture(() => parseH2HText(exported));
  return {
    id,
    exported,
    parsed,
    exactIds: parsed.ok && parsed.value.some(item => item.id === id) && parsed.value.some(item => item.id === "other"),
  };
};
const characterizeSharedId = id => {
  const exported = expH2H(buildH2H([edge("h1", [id]), edge("h2", [id])]));
  const parsed = capture(() => parseH2HText(exported));
  return {
    id,
    exported,
    parsed,
    exactShared: parsed.ok && parsed.value.every(item => item.vertices.map(String).includes(id)),
  };
};

const quotedCases = {
  quotedShared: '"foo[shared: bar]",x\nsecond,row',
  quotedWholeH2H: '"h1: h2[shared: x]",other',
  quotedMultilineH2H: '"line1\nh1: h2[shared: x]",foo\nsecond,row',
  unquotedCsvPayload: "foo[shared: bar],x\nsecond,row",
};
const commentCases = {
  comma: "# comment, containing comma\n1 2 3\n2 4",
  leadingSpace: "   # comment, containing comma\n1 2 3\n2 4",
  quote: '# comment "with quotes"\n1 2 3\n2 4',
  betweenRows: "1 2 3\n# comment, punctuation\n2 4",
  crlf: "# comment, containing comma\r\n1 2 3\r\n2 4",
  both: '# "quoted", comment\n1 2 3',
};

const artifact = {
  stage: 2,
  kind: "corrective_prechange_characterization",
  parentCommit: EXPECTED_PARENT,
  confirmedGaps: {
    "S2-R03A": Object.fromEntries(Object.entries(quotedCases).map(([name, text]) => [name, autoDetect(text)])),
    "S2-R03B": Object.fromEntries(Object.entries(commentCases).map(([name, text]) => [name, capture(() => parseCSVFmt(text).map(item => item.vertices))])),
  },
  h2hRepresentability: {
    hyperedgeIds: [
      "plain", "edge:colon", "edge[bracket", "edge]bracket", "internal space",
      " leading", "trailing ", "edge,comma", '"literal-quote"', "__proto__", "null", "#comment-like", "line\nbreak",
    ].map(characterizeEdgeId),
    sharedVertexIds: [
      "plain", "v:1", "left[open", "ends]", "shared,comma", "shared space",
      '"quoted"', "__proto__", "null", "0", "007", "line\nbreak",
    ].map(characterizeSharedId),
  },
  failingCorrectiveTests: [
    "tests/stage2-corrective-detection-comments.test.mjs",
    "tests/stage2-corrective-h2h-representability.test.mjs",
  ],
};
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage2-corrective-prechange.json");
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 2 corrective pre-change evidence: ${outputPath}`);
