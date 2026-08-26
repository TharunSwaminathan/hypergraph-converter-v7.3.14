import {
  EXPORT_PREVIEWS,
  resolveExportAlias,
  resolveInputRouteAlias,
} from "./routeRegistry.js";

const WORD_BOUNDARY = "[^a-z0-9]";

export const normalizeIntentText = text => String(text ?? "")
  .toLowerCase()
  .replace(/[‘’`]/g, "'")
  .replace(/[“”]/g, "\"")
  .replace(/\s+/g, " ")
  .trim();

function cleanSegment(value = "") {
  return String(value)
    .replace(/^[\s:,\-=]+|[\s:,\-=]+$/g, "")
    .replace(/\b(?:please|for me)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortByAliasLength(aliases) {
  return [...aliases].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export const FORMAT_LEXICON = [
  {
    id: "incidence",
    label: "Incidence edge list",
    inputRoute: "incidence",
    exportId: "incidence",
    aliases: [
      "incidence edge list",
      "incidence list",
      "incidence csv",
      "incidence memberships",
      "incidence membership",
      "incidence",
    ],
  },
  {
    id: "csr_csv",
    label: "CSR/CSC CSV",
    inputRoute: "csr_csv",
    exportId: "csr_csv",
    aliases: [
      "csr/csc csv",
      "csr csc csv",
      "csr csv",
      "csc csv",
      "compressed sparse row csv",
      "compressed sparse column csv",
      "compressed sparse csv",
    ],
  },
  {
    id: "csr_json",
    label: "CSR JSON",
    inputRoute: "csr_json",
    exportId: "csr_json",
    aliases: [
      "csr json",
      "compressed sparse row json",
      "compressed sparse row",
      "csr",
    ],
  },
  {
    id: "csc_csv_route",
    label: "CSC CSV",
    inputRoute: "csr_csv",
    exportId: "csr_csv",
    aliases: [
      "csc",
      "compressed sparse column",
    ],
  },
  {
    id: "canonical_json",
    label: "Canonical JSON",
    inputRoute: "json",
    exportId: "canonical",
    aliases: [
      "canonical json",
      "canonical hypergraph json",
      "canonical",
    ],
  },
  {
    id: "full_json",
    label: "Full JSON",
    inputRoute: "json",
    exportId: "full_json",
    aliases: [
      "full json",
      "expanded json",
      "complete json",
    ],
  },
  {
    id: "json",
    label: "JSON",
    inputRoute: "json",
    exportId: null,
    aliases: [
      "json",
      "json input",
      "json file",
      "json data",
    ],
  },
  {
    id: "h2v",
    label: "H2V",
    inputRoute: "simple",
    exportId: "h2v_txt",
    aliases: [
      "hyperedge to vertex",
      "hyperedge-to-vertex",
      "hyperedges to vertices",
      "hyperedge vertex",
      "h2v text",
      "h2v",
      "simple h2v",
      "simple input",
    ],
  },
  {
    id: "v2h",
    label: "V2H",
    inputRoute: "v2h",
    exportId: "v2h_txt",
    aliases: [
      "vertex to hyperedge",
      "vertex-to-hyperedge",
      "vertices to hyperedges",
      "vertex hyperedge",
      "v2h text",
      "v2h",
    ],
  },
  {
    id: "h2h",
    label: "H2H projection",
    inputRoute: "h2h",
    exportId: "h2h_txt",
    aliases: [
      "hyperedge to hyperedge",
      "hyperedge-to-hyperedge",
      "hyperedge projection",
      "h2h projection",
      "h2h text",
      "h2h",
    ],
  },
  {
    id: "edge_list",
    label: "Graph edge list",
    inputRoute: "edgelist",
    exportId: null,
    aliases: [
      "graph edge list",
      "pairwise graph edge list",
      "pairwise edge list",
      "edge-list",
      "edge list",
    ],
  },
  {
    id: "csv",
    label: "CSV",
    inputRoute: "csv",
    exportId: null,
    aliases: [
      "comma separated values",
      "comma-separated values",
      "csv input",
      "csv file",
      "csv data",
      "csv",
    ],
  },
  {
    id: "cornell",
    label: "Cornell/SNAP",
    inputRoute: "cornell",
    exportId: null,
    aliases: [
      "cornell snap",
      "cornell/snap",
      "cornell",
      "snap",
      "nverts",
      "simplices",
    ],
  },
  {
    id: "adjlist",
    label: "Adjacency list",
    inputRoute: "adjlist",
    exportId: null,
    aliases: [
      "adjacency list",
      "adj list",
      "adjlist",
    ],
  },
  {
    id: "bipartite",
    label: "Bipartite CSV",
    inputRoute: null,
    exportId: "bipartite",
    aliases: [
      "bipartite csv",
      "bipartite graph csv",
      "bipartite graph",
      "bipartite",
    ],
  },
  {
    id: "clique",
    label: "Clique expansion CSV",
    inputRoute: null,
    exportId: "clique",
    aliases: [
      "clique expansion csv",
      "clique csv",
      "pairwise clique csv",
      "clique expansion",
      "clique",
    ],
  },
  {
    id: "matrix",
    label: "Matrix CSV",
    inputRoute: null,
    exportId: "matrix",
    aliases: [
      "incidence matrix csv",
      "matrix csv",
      "matrix",
    ],
  },
  {
    id: "all_txt",
    label: "All mappings text",
    inputRoute: null,
    exportId: "all_txt",
    aliases: [
      "all mappings text",
      "all mappings txt",
      "all mappings",
      "all text",
    ],
  },
];

const LEXICON_ALIASES = FORMAT_LEXICON.flatMap(entry => sortByAliasLength(entry.aliases).map(alias => ({
  ...entry,
  alias: normalizeIntentText(alias),
}))).sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias));

const WORD_FAMILIES = new Map(Object.entries({
  consumes: "consume",
  consumed: "consume",
  consuming: "consume",
  emits: "emit",
  emitted: "emit",
  emitting: "emit",
  delivers: "deliver",
  delivered: "deliver",
  delivering: "deliver",
  serializes: "serialize",
  serialized: "serialize",
  serializing: "serialize",
  encodes: "encode",
  encoded: "encode",
  encoding: "encode",
  decodes: "decode",
  decoded: "decode",
  decoding: "decode",
  ingests: "ingest",
  ingested: "ingest",
  ingesting: "ingest",
  parses: "parse",
  parsed: "parse",
  parsing: "parse",
  reads: "read",
  reading: "read",
  writes: "write",
  written: "write",
  writing: "write",
  saves: "save",
  saved: "save",
  saving: "save",
  returns: "return",
  returned: "return",
  returning: "return",
  produces: "produce",
  produced: "produce",
  producing: "produce",
  generates: "generate",
  generated: "generate",
  generating: "generate",
  represents: "represent",
  represented: "represent",
  representing: "represent",
  formatted: "format",
  formatting: "format",
  converts: "convert",
  converted: "convert",
  converting: "convert",
  transformed: "transform",
  transforming: "transform",
  translates: "translate",
  translated: "translate",
  translating: "translate",
  changes: "change",
  changed: "change",
  changing: "change",
  becomes: "become",
  became: "become",
  becoming: "become",
  turns: "turn",
  turned: "turn",
  turning: "turn",
  accepts: "accept",
  accepted: "accept",
  accepting: "accept",
  loads: "load",
  loaded: "load",
  loading: "load",
  imports: "import",
  imported: "import",
  importing: "import",
  publishes: "publish",
  published: "publish",
  publishing: "publish",
  yields: "yield",
  yielded: "yield",
  yielding: "yield",
  renders: "render",
  rendered: "render",
  rendering: "render",
  opens: "open",
  opened: "open",
  opening: "open",
  materializes: "materialize",
  materialized: "materialize",
  materializing: "materialize",
  interprets: "interpret",
  interpreted: "interpret",
  interpreting: "interpret",
  arrives: "arrive",
  arrived: "arrive",
  arriving: "arrive",
  leaves: "leave",
  left: "leave",
  leaving: "leave",
  comes: "come",
  came: "come",
  coming: "come",
  goes: "go",
  went: "go",
  going: "go",
  conforms: "conform",
  conformed: "conform",
  conforming: "conform",
}));

const SOURCE_CONSUMING_VERBS = new Set([
  "consume",
  "ingest",
  "read",
  "parse",
  "decode",
  "accept",
  "load",
  "import",
  "open",
  "interpret",
]);

const TARGET_PRODUCING_VERBS = new Set([
  "emit",
  "deliver",
  "return",
  "write",
  "serialize",
  "encode",
  "produce",
  "publish",
  "yield",
  "render",
  "save",
  "generate",
  "materialize",
  "export",
  "output",
]);

const STATE_TRANSITION_VERBS = new Set(["convert", "transform", "translate", "change", "turn", "become", "represent", "map"]);

const SOURCE_ROLE_LABEL_AT_END = /\b(?:(?:source|input|incoming|inbound|origin|original|current|starting|initial|read|parse|decode|ingest)(?:\s+(?:format|representation|input|side))?|current\s+representation|starting\s+representation|initial\s+representation|left(?:-hand)?(?:\s+side)?|left)\s*(?:is|=|:)?\s*(?:an?\s+|the\s+)?$/;
const TARGET_ROLE_LABEL_AT_END = /\b(?:(?:target|destination|output|outgoing|outbound|result|resulting|final|write|serialization|export)(?:\s+(?:format|representation|output|side))?|required\s+output|desired\s+output|final\s+representation|resulting\s+representation|right(?:-hand)?(?:\s+side)?|right)\s*(?:is|=|:)?\s*(?:an?\s+|the\s+)?$/;
const SOURCE_ROLE_LABEL_AT_START = /^\s*(?:(?:is|as)\s+(?:the\s+)?|(?:the\s+)?)?(?:(?:source|input|incoming|inbound|origin|original)(?:\s+(?:format|representation|input))?|current\s+(?:input|representation)|starting\s+representation|initial\s+representation|left(?:-hand)?(?:\s+side)?|read\s+format|parse\s+format|decode\s+format|ingest\s+format)\b/;
const TARGET_ROLE_LABEL_AT_START = /^\s*(?:(?:is|as)\s+(?:the\s+)?|(?:the\s+)?)?(?:(?:target|destination|output|outgoing|outbound)(?:\s+(?:format|representation|output))?|result(?:ing)?\s+(?:format|representation|output)|required\s+output|desired\s+output|final\s+representation|right(?:-hand)?(?:\s+side)?|write\s+format|serialization\s+format|export\s+format)\b/;
const EXPLICIT_CONVERSION_VERB_RE = /\b(?:convert|transform|translate|map|mapping|export|emit|deliver|serialize|encode|decode|consume|ingest|parse|read|write|save|return|produce|generate|publish|yield|render|materialize|load|accept|import|from|to|into|source|target|input|output|incoming|outgoing|inbound|outbound|destination|origin|result|final|current\s+representation|starting\s+representation|initial\s+representation|resulting\s+representation)\b|[-=]>\b|→/;

function normalizeWord(word) {
  const value = normalizeIntentText(word);
  return WORD_FAMILIES.get(value) ?? value;
}

function tokenizeIntentText(value) {
  const normalized = normalizeIntentText(value);
  const boundaries = [];
  const boundaryRx = /[.;:?!,\n]|(?:\b(?:then|but|however|whereas|while|so)\b)/g;
  for (const match of normalized.matchAll(boundaryRx)) {
    boundaries.push(match.index);
  }

  const tokens = [];
  const tokenRx = /[a-z0-9]+(?:'[a-z0-9]+)?/g;
  for (const match of normalized.matchAll(tokenRx)) {
    const start = match.index;
    const end = start + match[0].length;
    const sentenceIndex = normalized.slice(0, start).split(/[.;?!\n]+/).length - 1;
    const clauseIndex = boundaries.filter(index => index < start).length;
    tokens.push({
      text: match[0],
      lemma: normalizeWord(match[0]),
      start,
      end,
      sentenceIndex,
      clauseIndex,
    });
  }
  return { value: normalized, tokens };
}

function attachMentionTokenData(value, mentions) {
  const analysis = tokenizeIntentText(value);
  return {
    ...analysis,
    mentions: mentions.map((mention, mentionIndex) => {
      const overlapping = analysis.tokens.filter(token => token.start < mention.end && token.end > mention.start);
      const first = overlapping[0] ?? analysis.tokens.find(token => token.end >= mention.start);
      const last = overlapping.at(-1) ?? first;
      return {
        ...mention,
        mentionIndex,
        startToken: first ? analysis.tokens.indexOf(first) : -1,
        endToken: last ? analysis.tokens.indexOf(last) : -1,
        sentenceIndex: first?.sentenceIndex ?? -1,
        clauseIndex: first?.clauseIndex ?? -1,
      };
    }),
  };
}

// Kept as public exports for compatibility with older tests/imports. The
// resolver no longer depends on brittle ordered regex templates.
export const SOURCE_PATTERNS = [];
export const ROUTE_COMMAND_PATTERNS = [];
export const TARGET_PATTERNS = [];

function boundaryAliasRegex(alias) {
  return new RegExp(`(^|${WORD_BOUNDARY})(${escapeRegExp(alias)})(?=$|${WORD_BOUNDARY})`, "g");
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

export function detectFormatMentions(text) {
  const value = normalizeIntentText(text);
  const candidates = [];
  for (const entry of LEXICON_ALIASES) {
    const rx = boundaryAliasRegex(entry.alias);
    for (const match of value.matchAll(rx)) {
      const start = match.index + match[1].length;
      const end = start + match[2].length;
      candidates.push({
        id: entry.id,
        label: entry.label,
        inputRoute: entry.inputRoute,
        exportId: entry.exportId,
        alias: entry.alias,
        matchedText: match[2],
        start,
        end,
      });
    }
  }

  const chosen = [];
  for (const mention of candidates.sort((a, b) => (
    a.start - b.start
      || (b.end - b.start) - (a.end - a.start)
      || a.id.localeCompare(b.id)
  ))) {
    const existing = chosen.find(item => overlaps(item, mention));
    if (!existing) {
      chosen.push(mention);
      continue;
    }
    const existingLength = existing.end - existing.start;
    const nextLength = mention.end - mention.start;
    if (mention.start === existing.start && nextLength > existingLength) {
      const index = chosen.indexOf(existing);
      chosen.splice(index, 1, mention);
    }
  }

  const sorted = chosen.sort((a, b) => a.start - b.start || a.end - b.end);
  return attachMentionTokenData(value, sorted).mentions;
}

function getClauseBounds(value, mention) {
  const hardStart = Math.max(
    value.lastIndexOf(".", mention.start - 1),
    value.lastIndexOf(";", mention.start - 1),
    value.lastIndexOf("?", mention.start - 1),
    value.lastIndexOf("!", mention.start - 1),
    value.lastIndexOf("\n", mention.start - 1),
  ) + 1;
  const hardStops = [".", ";", "?", "!", "\n"]
    .map(token => value.indexOf(token, mention.end))
    .filter(index => index >= 0);
  const hardEnd = hardStops.length ? Math.min(...hardStops) : value.length;

  const local = value.slice(hardStart, hardEnd);
  const relativeStart = mention.start - hardStart;
  const beforeConnectors = [...local.slice(0, relativeStart).matchAll(/\b(?:then|but|however|except|although|whereas)\b/g)]
    .map(match => match.index + match[0].length);
  const afterConnector = local.slice(mention.end - hardStart).search(/\b(?:then|but|however|except|although|whereas)\b/);
  return {
    start: beforeConnectors.length ? hardStart + beforeConnectors[beforeConnectors.length - 1] : hardStart,
    end: afterConnector >= 0 ? mention.end + afterConnector : hardEnd,
  };
}

function contextFor(value, mention) {
  const clause = getClauseBounds(value, mention);
  const before = value.slice(Math.max(clause.start, mention.start - 90), mention.start);
  const after = value.slice(mention.end, Math.min(clause.end, mention.end + 90));
  const fullBefore = value.slice(0, mention.start);
  const fullAfter = value.slice(mention.end);
  const clauseText = value.slice(clause.start, clause.end);
  return { clause, before, after, fullBefore, fullAfter, clauseText };
}

function hasRecentCue(text, cueRegex, maxDistance = 40) {
  const matches = [...text.matchAll(cueRegex)];
  if (!matches.length) return false;
  const match = matches[matches.length - 1];
  return text.length - (match.index + match[0].length) <= maxDistance;
}

function scoreMention(value, mention) {
  const ctx = contextFor(value, mention);
  const sourceReasons = [];
  const targetReasons = [];
  const targetConcept = Boolean(mention.exportId || mention.id === "edge_list" || mention.id === "json");
  let sourceScore = mention.inputRoute ? 1 : -100;
  let targetScore = mention.exportId ? 1 : (targetConcept ? 0 : -100);
  let sourceLocked = false;
  let targetLocked = false;

  const addSource = (points, reason, { lock = false, suppressTarget = 0 } = {}) => {
    if (mention.inputRoute) {
      sourceScore += points;
      sourceReasons.push(reason);
      if (lock) {
        sourceLocked = true;
        targetScore -= suppressTarget || 70;
        targetReasons.push(`suppressed by source role lock: ${reason}`);
      }
    }
  };
  const addTarget = (points, reason, { lock = false, suppressSource = 0 } = {}) => {
    if (targetConcept) {
      targetScore += points;
      targetReasons.push(reason);
      if (lock) {
        targetLocked = true;
        sourceScore -= suppressSource || 70;
        sourceReasons.push(`suppressed by target role lock: ${reason}`);
      }
    }
  };

  if (/\b(?:source|input)(?:\s+format)?\s*(?:is|=|:)?\s*$/.test(ctx.before)) addSource(38, "input/source label before mention", { lock: true });
  if (/\bfor\s+(?:the\s+)?(?:input|source)\s+(?:use|choose|select|set|read\s+as|treat\s+as)\s*$/.test(ctx.before)) addSource(42, "for input/source label before mention", { lock: true });
  if (/\bfrom\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+|my\s+)?$/.test(ctx.before)) addSource(30, "from before source");
  const parseAsSourceCue = /\b(?:parse|read|interpret|treat)(?:\s+(?:this|it|this\s+file|this\s+data|this\s+dataset|the\s+file|the\s+upload|the\s+uploaded\s+file|the\s+dataset|the\s+uploaded\s+dataset|the\s+uploaded\s+batch))?\s+as\s+$/.test(ctx.before);
  if (parseAsSourceCue) addSource(42, "parse/read/treat as source", { lock: true });
  if (/\b(?:the\s+)?(?:uploaded\s+)?(?:file|data|dataset|batch|content|input)(?:\s+i\s+uploaded)?\s+(?:is|uses|contains|use|is\s+encoded\s+in|is\s+formatted\s+as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
    addSource(38, "file/data/source noun relation before mention", { lock: true });
  }
  if (/\b(?:which|that)\s+(?:is|uses|contains|is\s+encoded\s+in|is\s+formatted\s+as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
    addSource(38, "relative clause source relation", { lock: true });
  }
  if (/\b(?:data|content|dataset|file|input)\s+(?:encoded|represented|stored|structured|formatted)\s+(?:in|as)\s+$/.test(ctx.before)) {
    addSource(42, "encoded/represented source relation", { lock: true });
  }
  if (/\b(?:the\s+)?upload\s+contains\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) addSource(36, "upload contains source cue", { lock: true });
  if (/\b(?:uploaded|upload(?:ed)?|have|got|given|take|using)\s+(?:an?\s+|the\s+|my\s+|uploaded\s+)?$/.test(ctx.before)) addSource(26, "uploaded/have/take source cue");
  if (/\b(?:could\s+you\s+|can\s+you\s+|please\s+)?take\s+(?:my\s+|the\s+|this\s+)?$/.test(ctx.before)) addSource(36, "take source cue", { lock: true });
  if (/\b(?:starting|start)\s+with\s+$/.test(ctx.before)) addSource(32, "starting with source cue", { lock: true });
  if (/\b(?:this|it)\s+is\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) addSource(28, "this is source cue");
  if (/\bthis\s+(?:file|data|dataset|upload|content|input)\s+(?:is|uses|contains)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) addSource(32, "this file/data source cue", { lock: true });
  if (/\bhere(?:'s|\s+is)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) addSource(24, "here is source cue");
  if (/\b(?:use|open|select|switch(?:\s+to)?)\s+$/.test(ctx.before)) addSource(10, "route command cue");
  if (/^\s*(?:file|data|dataset|content|input|source|format|representation|route|tab)\b/.test(ctx.after)) addSource(22, "source suffix cue");
  if (/^\s*(?:[- ]?formatted|[- ]?encoded|[- ]?represented)\s+(?:file|data|dataset|content|input)?\b/.test(ctx.after)) {
    addSource(42, "formatted/encoded source suffix", { lock: true });
  }
  if (/^\s*(?:as\s+)?(?:the\s+)?(?:input|source)\b/.test(ctx.after)) addSource(44, "as input/source suffix", { lock: true });
  if (/^\s*is\s+(?:the\s+)?(?:current\s+)?(?:input|source|source\s+format)\b/.test(ctx.after)) addSource(48, "copular source label after mention", { lock: true });
  if (/^\s*(?:is\s+)?(?:the\s+)?(?:current\s+)?(?:input|source)\b/.test(ctx.after)) addSource(32, "source label after mention", { lock: true });
  if (/\b(?:file|data|dataset|input)\s*$/.test(mention.matchedText)
    && /\b(?:use|convert|turn|transform|export|save|download)\s+(?:this|my|the|the\s+uploaded|uploaded)?\s*$/.test(ctx.before)) {
    addSource(26, "format phrase names the source file/data object", { lock: true });
  }

  if (/\b(?:target|output|desired\s+output|required\s+output)(?:\s+format)?\s*(?:is|=|:)?\s*$/.test(ctx.before)) addTarget(42, "target/output label before mention", { lock: true });
  if (/\bfor\s+(?:the\s+)?(?:output|target)\s+(?:use|choose|select|set|write\s+as|return|produce|generate)\s*$/.test(ctx.before)) addTarget(44, "for output/target label before mention", { lock: true });
  if (/\b(?:export|exporting|exported|output|produce|producing|produced|generate|generating|generated|make|making|made|create|creating|created|save|saving|saved|download|preview|return|returning|returned|write|writing|written|become|becomes|became|change\s+into|change\s+to|turn\s+into|transform\s+to)(?:\s+(?:it|this|the\s+file|the\s+graph|the\s+hypergraph|the\s+upload|the\s+dataset|my\s+input))?\s*(?:as|to|in|into)?\s*(?:an?\s+|the\s+)?$/.test(ctx.before)) {
    addTarget(34, "export/return/write target cue before mention");
  }
  if (/\b(?:give me|show me|i need|need|i want|want|would like|like)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) addTarget(26, "request target cue");
  if (/\b(?:to|into|in)\s*$/.test(ctx.before) || (/\bas\s*$/.test(ctx.before) && !parseAsSourceCue)) addTarget(22, "to/into/as target cue");
  if (/^\s*(?:output|target|format|file|representation)\b/.test(ctx.after)) addTarget(8, "target suffix cue");
  if (/^\s*(?:as\s+)?(?:the\s+)?(?:output|target)\b/.test(ctx.after)) addTarget(44, "as output/target suffix", { lock: true });
  if (/^\s*is\s+(?:the\s+)?(?:required|desired|requested|target)\s+(?:output|target|format)\b/.test(ctx.after)) addTarget(48, "copular target label after mention", { lock: true });
  if (/^\s*(?:is\s+)?(?:the\s+)?(?:required|desired|requested)\s+output\b/.test(ctx.after)) addTarget(42, "required/desired output after mention", { lock: true });
  if (/^\s*(?:version|representation|output|export)\s+of\b/.test(ctx.after)) addTarget(32, "target version/representation suffix");

  if (hasRecentCue(ctx.fullBefore, /\b(?:source|input|uploaded|upload|parse|read|interpret|treat|have|got|starting)\b/g, 70)) {
    addSource(6, "nearby source cue");
  }
  if (hasRecentCue(ctx.fullBefore, /\b(?:target|output|export|download|preview|produce|generate|make|create|save|give|show|need|want|convert|transform|turn)\b/g, 70)) {
    addTarget(6, "nearby target cue");
  }

  if (/\b(?:export|save|download|convert|turn|transform)\s+(?:this|the\s+uploaded|uploaded|my)\s+$/.test(ctx.before)
    && /^\s*(?:file|data|dataset|input)\b/.test(ctx.after)) {
    addSource(28, "exported object source cue", { lock: true });
    targetScore -= 40;
    targetReasons.push("format describes the source object being exported");
  }

  if (/\bactually\s+(?:treat\s+(?:this|it)\s+as\s+|this\s+is\s+)?$/.test(ctx.before)) addSource(16, "correction source cue");
  if (/^\s*(?:instead|instead please|please instead)\b/.test(ctx.after)) addTarget(8, "target followed by instead");

  const negatedBefore = /\b(?:not|no|never|don't|do not|dont|instead of|rather than)\s+(?:an?\s+|the\s+|give me\s+|use\s+|export\s+|output\s+)?$/.test(ctx.before);
  const rejectedPhrase = /\b(?:don't|do not|dont)\s+(?:give me|use|export|output|select)\s+(?:an?\s+|the\s+)?$/.test(ctx.before);
  const negatedAfter = /^\s*(?:is\s+wrong|is\s+not\s+right|was\s+wrong|instead\b|please\s+don't|please\s+do\s+not)/.test(ctx.after);
  const negated = Boolean(negatedBefore || rejectedPhrase || negatedAfter);
  if (negated) {
    sourceScore -= 80;
    targetScore -= 80;
    sourceReasons.push("negated/rejected mention");
    targetReasons.push("negated/rejected mention");
  }

  if (sourceLocked && !targetLocked) {
    targetScore -= 30;
    targetReasons.push("suppressed by explicit source role");
  }
  if (targetLocked && !sourceLocked) {
    sourceScore -= 30;
    sourceReasons.push("suppressed by explicit target role");
  }

  return {
    ...mention,
    sourceScore,
    targetScore,
    sourceReasons,
    targetReasons,
    sourceLocked,
    targetLocked,
    negated,
    clause: ctx.clause,
  };
}

function hasClearConversionIntent(value, mentions = []) {
  if (EXPLICIT_CONVERSION_VERB_RE.test(value)) return true;
  if (mentions.length >= 2 && /\b(?:use|switch)\b/.test(value) && /\b(?:left|right|source|target|input|output|incoming|outgoing)\b/.test(value)) return true;
  return false;
}

function leftRightRolesAllowed(value, mentions) {
  if (!mentions || mentions.length < 2) return false;
  if (/^\s*(?:show|display|view)\b/.test(value) && !/\b(?:convert|translate|transform|map|mapping|source|target|input|output)\b/.test(value)) {
    return false;
  }
  if (mentions.length === 2 && /\bleft(?:-hand)?(?:\s+side)?\b/.test(value) && /\bright(?:-hand)?(?:\s+side)?\b/.test(value)) {
    return true;
  }
  return hasClearConversionIntent(value, mentions);
}

function nearestVerbBefore(tokens, mention, verbSet, { maxDistance = 9, sameClause = true } = {}) {
  if (mention.startToken < 0) return null;
  for (let index = mention.startToken - 1; index >= 0 && mention.startToken - index <= maxDistance; index -= 1) {
    const token = tokens[index];
    if (sameClause && token.clauseIndex !== mention.clauseIndex) break;
    if (verbSet.has(token.lemma)) {
      return {
        token,
        tokenIndex: index,
        distance: mention.startToken - index,
      };
    }
  }
  return null;
}

function tokensBetween(tokens, left, right) {
  if (!left || !right || left.endToken < 0 || right.startToken < 0) return [];
  return tokens.slice(left.endToken + 1, right.startToken);
}

function relationExists(relations, next) {
  return relations.some(relation => relation.type === next.type
    && relation.role === next.role
    && relation.mentionIndex === next.mentionIndex
    && relation.sourceMentionIndex === next.sourceMentionIndex
    && relation.targetMentionIndex === next.targetMentionIndex);
}

function extractSemanticRelations(value, mentions) {
  const { tokens } = tokenizeIntentText(value);
  const relations = [];
  const allowLeftRight = leftRightRolesAllowed(value, mentions);
  const add = next => {
    if (!next || relationExists(relations, next)) return;
    relations.push({
      confidence: 1,
      ...next,
    });
  };
  const addRole = (role, mention, type, reason, confidence = 1) => {
    add({
      type,
      role,
      mentionIndex: mention.mentionIndex,
      confidence,
      reason,
    });
  };

  for (const mention of mentions) {
    if (mention.negated) continue;
    const ctx = contextFor(value, mention);
    const sourceBefore = SOURCE_ROLE_LABEL_AT_END.test(ctx.before)
      || /\b(?:file|data|dataset|content|input|upload)\s+(?:is|are|uses|use|contains|conforms?\s+to|arrives?\s+as|comes?\s+in|goes?\s+in|is\s+encoded\s+in|is\s+represented\s+(?:in|as)|is\s+formatted\s+as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)
      || /\b(?:currently|already|existing|current\s+representation)\s+(?:is\s+)?(?:in|as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)
      || /\b(?:parse|read|decode|ingest|interpret)\s+(?:according\s+to|using|in|as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before);
    const targetBefore = TARGET_ROLE_LABEL_AT_END.test(ctx.before)
      || /\b(?:result|output|export|destination|target)\s+(?:should\s+)?(?:be|be\s+in|come\s+out\s+as|comes?\s+out\s+as|conforms?\s+to|is|are|in)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)
      || /\b(?:result|output|export|it|this|the\s+dataset|the\s+file|the\s+graph|the\s+hypergraph)\s+(?:should\s+)?(?:be\s+)?(?:represented|serialized|encoded|rendered|written|saved)\s+(?:as|in|using|to)\s+(?:an?\s+|the\s+)?$/.test(ctx.before);

    if (sourceBefore) addRole("source", mention, "ROLE_LABEL", "source role label before format");
    if (targetBefore) addRole("target", mention, "ROLE_LABEL", "target role label before format");
    if (SOURCE_ROLE_LABEL_AT_START.test(ctx.after)) addRole("source", mention, "ROLE_LABEL", "source role label after format");
    if (TARGET_ROLE_LABEL_AT_START.test(ctx.after)) addRole("target", mention, "ROLE_LABEL", "target role label after format");
    if (allowLeftRight && /^\s*(?:on|for|as)\s+(?:the\s+)?left(?:-hand)?(?:\s+side)?\b/.test(ctx.after)) {
      addRole("source", mention, "LEFT_RIGHT", "left side source role");
    }
    if (allowLeftRight && /^\s*(?:on|for|as)\s+(?:the\s+)?right(?:-hand)?(?:\s+side)?\b/.test(ctx.after)) {
      addRole("target", mention, "LEFT_RIGHT", "right side target role");
    }

    const sourceVerb = nearestVerbBefore(tokens, mention, SOURCE_CONSUMING_VERBS);
    const targetVerb = nearestVerbBefore(tokens, mention, TARGET_PRODUCING_VERBS);
    const mentionNamesSourceObject = /^\s*(?:file|data|dataset|batch|content|input|upload)\b/.test(ctx.after)
      || /\b(?:file|data|dataset|batch|content|input|upload)\s*$/.test(mention.matchedText);
    if (sourceVerb && (!targetVerb || sourceVerb.distance < targetVerb.distance)) {
      addRole("source", mention, "SOURCE_CONSUMING_VERB", `${sourceVerb.token.lemma} governs source format`, 0.95);
    }
    if (targetVerb && !mentionNamesSourceObject && (!sourceVerb || targetVerb.distance <= sourceVerb.distance)) {
      addRole("target", mention, "TARGET_PRODUCING_VERB", `${targetVerb.token.lemma} governs target format`, 0.95);
    }

    if (/^\s*(?:for|when|while)?\s*(?:parsing|reading|decoding|ingesting|importing|loading|interpreting)\b/.test(ctx.after)) {
      addRole("source", mention, "SOURCE_CONSUMING_VERB", "format is used for source-side operation", 0.95);
    }
    if (/^\s*(?:for|when|while)?\s*(?:writing|saving|serializing|encoding|rendering|publishing|exporting|delivering)\b/.test(ctx.after)) {
      addRole("target", mention, "TARGET_PRODUCING_VERB", "format is used for target-side operation", 0.95);
    }
    if (/\b(?:comes?|goes?|arrives?)\s+(?:in|as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
      addRole("source", mention, "COMES_IN_COMES_OUT", "incoming direction before format");
    }
    if (/\b(?:comes?|goes?)\s+out\s+(?:as|in)?\s*(?:an?\s+|the\s+)?$/.test(ctx.before)
      || /\bleaves?\s+(?:as|in)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
      addRole("target", mention, "COMES_IN_COMES_OUT", "outgoing direction before format");
    }
    if (/\b(?:currently|already|existing)\b.{0,40}\b(?:in|as)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
      addRole("source", mention, "CURRENT_REPRESENTATION_RESULT", "current/existing representation");
    }
    if (/\b(?:result|final|output|desired|required|should)\b.{0,50}\b(?:in|as|to|using)\s+(?:an?\s+|the\s+)?$/.test(ctx.before)) {
      addRole("target", mention, "CURRENT_REPRESENTATION_RESULT", "result/final representation");
    }
  }

  for (const source of mentions) {
    if (!source.inputRoute || source.negated) continue;
    for (const target of mentions) {
      if (target.start <= source.end || target.negated || (!target.exportId && target.id !== "edge_list" && target.id !== "json")) continue;
      const betweenText = value.slice(source.end, target.start);
      const sourceBefore = value.slice(Math.max(0, source.start - 80), source.start);
      const between = tokensBetween(tokens, source, target);
      const lemmas = between.map(token => token.lemma);
      const hasTargetProducerBetween = lemmas.some(lemma => TARGET_PRODUCING_VERBS.has(lemma));
      const hasStateTransitionBetween = lemmas.some(lemma => STATE_TRANSITION_VERBS.has(lemma)) || /\b(?:to|into|becomes?|became|should\s+be|represented\s+as)\b/.test(betweenText);

      if (/\b(?:from|starting\s+from|start\s+from|switch(?:\s+representation)?\s+from|translate\s+from|convert\s+from|map\s+from)\s*$/.test(sourceBefore)
        && /\b(?:to|into)\b/.test(betweenText)) {
        add({
          type: "FROM_TO",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "directional from/source to target",
        });
      }
      if (hasStateTransitionBetween) {
        add({
          type: "SOURCE_TRANSFORMS_TO_TARGET",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "source-to-target transition",
        });
      }
      if (hasTargetProducerBetween && hasClearConversionIntent(value, mentions) && !/\bfrom\b/.test(betweenText)) {
        add({
          type: "SOURCE_TRANSFORMS_TO_TARGET",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          confidence: 0.9,
          reason: "source mention before target-producing verb",
        });
      }
      if (allowLeftRight && /\b(?:left|left-hand|left\s+side)\b/.test(value.slice(source.start, source.end + betweenText.length))
        && /\b(?:right|right-hand|right\s+side)\b/.test(value.slice(target.start, Math.min(value.length, target.end + 40)))) {
        add({
          type: "LEFT_RIGHT",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "left/right conversion mapping",
        });
      }
      if (/\b(?:incoming|inbound)\b/.test(value.slice(Math.max(0, source.start - 30), source.end + 50))
        && /\b(?:outgoing|outbound)\b/.test(value.slice(Math.max(0, target.start - 30), target.end + 50))) {
        add({
          type: "INCOMING_OUTGOING",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "incoming/outgoing pair",
        });
      }
      if (/\b(?:comes?|goes?|arrives?)\s+(?:in|as)\b/.test(value.slice(Math.max(0, source.start - 40), source.end + 10))
        && (/\b(?:comes?|goes?)\s+out\b/.test(value.slice(Math.max(0, target.start - 60), target.end + 10))
          || /\bleaves?\s+(?:as|in)\b/.test(value.slice(Math.max(0, target.start - 60), target.end + 10)))) {
        add({
          type: "COMES_IN_COMES_OUT",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "comes/goes in and out pair",
        });
      }
    }
  }

  for (const target of mentions) {
    if (target.negated || (!target.exportId && target.id !== "edge_list" && target.id !== "json")) continue;
    if (target.sourceLocked && target.sourceScore > target.targetScore) continue;
    for (const source of mentions) {
      if (source.start <= target.end || source.negated || !source.inputRoute) continue;
      const between = value.slice(target.end, source.start);
      const targetBefore = value.slice(Math.max(0, target.start - 80), target.start);
      if (/\b(?:create|make|produce|generate|publish|yield|render|materialize|export|return|write|save|need|want)\b/.test(targetBefore)
        && /\b(?:from|using|after\s+(?:reading|parsing|loading|importing)|version\s+of|representation\s+of|export\s+from)\b/.test(between)) {
        add({
          type: "TARGET_FROM_SOURCE",
          sourceMentionIndex: source.mentionIndex,
          targetMentionIndex: target.mentionIndex,
          reason: "target-first relation from/using source",
        });
      }
    }
  }

  return relations;
}

function applyStructuralScores(value, scored) {
  const mentions = scored.map(mention => ({ ...mention }));
  const relations = extractSemanticRelations(value, mentions);
  const boostSource = (mention, points, reason, { lock = false } = {}) => {
    if (!mention?.inputRoute) return;
    mention.sourceScore += points;
    mention.sourceReasons.push(reason);
    if (lock) {
      mention.sourceLocked = true;
      mention.targetScore -= 90;
      mention.targetReasons.push(`suppressed by structural source lock: ${reason}`);
    }
  };
  const boostTarget = (mention, points, reason, { lock = false } = {}) => {
    if (!mention || (!mention.exportId && mention.id !== "edge_list" && mention.id !== "json")) return;
    mention.targetScore += points;
    mention.targetReasons.push(reason);
    if (lock) {
      mention.targetLocked = true;
      mention.sourceScore -= 90;
      mention.sourceReasons.push(`suppressed by structural target lock: ${reason}`);
    }
  };

  const mentionByIndex = index => mentions.find(mention => mention.mentionIndex === index);
  for (const relation of relations) {
    if (relation.role === "source") {
      boostSource(mentionByIndex(relation.mentionIndex), relation.type === "ROLE_LABEL" ? 110 : 88, `${relation.type}: ${relation.reason}`, { lock: true });
    }
    if (relation.role === "target") {
      boostTarget(mentionByIndex(relation.mentionIndex), relation.type === "ROLE_LABEL" ? 110 : 88, `${relation.type}: ${relation.reason}`, { lock: true });
    }
    if (Number.isInteger(relation.sourceMentionIndex)) {
      boostSource(mentionByIndex(relation.sourceMentionIndex), 96, `${relation.type}: ${relation.reason}`, { lock: true });
    }
    if (Number.isInteger(relation.targetMentionIndex)) {
      boostTarget(mentionByIndex(relation.targetMentionIndex), 96, `${relation.type}: ${relation.reason}`, { lock: true });
    }
  }

  for (const arrow of ["->", "=>", "→"]) {
    const index = value.indexOf(arrow);
    if (index < 0) continue;
    const left = mentions.filter(item => item.end <= index && item.inputRoute && !item.negated).at(-1);
    const right = mentions.find(item => item.start >= index + arrow.length && (item.exportId || item.id === "edge_list") && !item.negated);
    if (left) {
      left.sourceScore += 70;
      left.sourceReasons.push("left side of arrow");
    }
    if (right) {
      right.targetScore += 70;
      right.targetReasons.push("right side of arrow");
    }
  }

  for (const source of mentions) {
    if (!source.inputRoute || source.negated) continue;
    for (const target of mentions) {
      if (target.start <= source.end || target.negated || (!target.exportId && target.id !== "edge_list")) continue;
      const beforeSource = value.slice(Math.max(0, source.start - 24), source.start);
      const between = value.slice(source.end, target.start);
      if (/\bfrom\s*$/.test(beforeSource) && /\b(?:to|into)\b/.test(between)) {
        source.sourceScore += 60;
        target.targetScore += 60;
        source.sourceReasons.push("from X to Y source");
        target.targetReasons.push("from X to Y target");
      }
      const sourceBefore = value.slice(Math.max(0, source.start - 40), source.start);
      if (/\b(?:source|input)(?:\s+format)?\s*(?:is|=|:)?\s*$/.test(sourceBefore) && /\b(?:target|output)(?:\s+format)?\s*(?:is|=|:)?\s*$/.test(value.slice(Math.max(0, target.start - 40), target.start))) {
        source.sourceScore += 45;
        target.targetScore += 45;
        source.sourceReasons.push("source label paired with target label");
        target.targetReasons.push("target label paired with source label");
      }
    }
  }

  for (const target of mentions) {
    if (target.negated || (!target.exportId && target.id !== "edge_list")) continue;
    if (target.sourceLocked && target.sourceScore > target.targetScore) continue;
    for (const source of mentions) {
      if (source.start <= target.end || !source.inputRoute || source.negated) continue;
      const between = value.slice(target.end, source.start);
      if (/\bfrom\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+)?$/.test(between) || /\bfrom\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+)?.{0,30}$/.test(between)) {
        target.targetScore += 60;
        source.sourceScore += 60;
        target.targetReasons.push("target-first from source");
        source.sourceReasons.push("target-first from source");
      }
    }
  }

  for (const source of mentions) {
    if (!source.inputRoute || source.negated) continue;
    for (const target of mentions) {
      if (target.start <= source.end || target.negated || (!target.exportId && target.id !== "edge_list" && target.id !== "json")) continue;
      const beforeSource = value.slice(Math.max(0, source.start - 70), source.start);
      const between = value.slice(source.end, target.start);
      if (/\b(?:from|go\s+from)\s*$/.test(beforeSource) && /\b(?:to|into|over\s+to)\b/.test(between)) {
        boostSource(source, 80, "directional from/source to target", { lock: true });
        boostTarget(target, 80, "directional from/source to target", { lock: true });
      }
      if (/\b(?:becomes?|became|should\s+become|turns?\s+into|changes?\s+into|converts?\s+to|converts?\s+into|converted\s+to|converted\s+into|transform(?:s|ed)?\s+to|into|to|over\s+to)\b/.test(between)) {
        boostSource(source, 72, "source before transformation verb", { lock: true });
        boostTarget(target, 72, "target after transformation verb", { lock: true });
      }
      if (!/\bfrom\b/.test(between) && /\b(?:and\s+)?(?:give\s+me|return|write|produce|generate|export|make\s+it|make|create|output)\b/.test(between)) {
        boostSource(source, 64, "source before return/write/generate relation", { lock: true });
        boostTarget(target, 64, "target after return/write/generate relation", { lock: true });
      }
    }
  }

  for (const target of mentions) {
    if (target.negated || (!target.exportId && target.id !== "edge_list" && target.id !== "json")) continue;
    if (target.sourceLocked && target.sourceScore > target.targetScore) continue;
    for (const source of mentions) {
      if (source.start <= target.end || !source.inputRoute || source.negated) continue;
      const between = value.slice(target.end, source.start);
      if (/\b(?:from|using)\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+|my\s+)?$/.test(between) || /\b(?:from|using)\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+)?.{0,35}$/.test(between)) {
        boostTarget(target, 80, "target-first from/using source", { lock: true });
        boostSource(source, 80, "target-first from/using source", { lock: true });
      }
      if (/\bafter\s+(?:reading|read|parsing|parse)\s+(?:the\s+|this\s+|my\s+)?$/.test(between) || /\bafter\s+(?:reading|read|parsing|parse)\s+(?:the\s+|this\s+|my\s+)?.{0,35}$/.test(between)) {
        boostTarget(target, 76, "target before after-reading source", { lock: true });
        boostSource(source, 76, "source after target/read relation", { lock: true });
      }
      if (/^\s*(?:version|representation|output|export)\s+of\s+(?:this\s+|the\s+uploaded\s+|uploaded\s+|my\s+)?/.test(between)) {
        boostTarget(target, 84, "target version/representation of source", { lock: true });
        boostSource(source, 84, "source in target version/representation construction", { lock: true });
      }
    }
  }

  for (let index = 0; index < mentions.length - 1; index += 1) {
    const left = mentions[index];
    const right = mentions[index + 1];
    if (!left.inputRoute || !right.inputRoute || left.negated || right.negated) continue;
    if (/\bor\b/.test(value.slice(left.end, right.start))) {
      boostSource(left, 56, "source alternative joined by or");
      boostSource(right, 56, "source alternative joined by or");
    }
  }

  return { scored: mentions, relations };
}

function selectBest(scored, role) {
  const idField = role === "source" ? "inputRoute" : "exportId";
  const scoreField = role === "source" ? "sourceScore" : "targetScore";
  const threshold = role === "source" ? 12 : 12;
  const candidates = scored
    .filter(item => !item.negated && item[idField] && item[scoreField] >= threshold)
    .sort((a, b) => b[scoreField] - a[scoreField] || a.start - b.start);
  const best = candidates[0] ?? null;
  const runnerUp = candidates.find(item => item[idField] !== best?.[idField]) ?? null;
  const sourceAlternative = role === "source"
    && best?.sourceReasons?.includes("source alternative joined by or")
    && runnerUp?.sourceReasons?.includes("source alternative joined by or");
  const ambiguous = Boolean(best && runnerUp && (sourceAlternative || best[scoreField] - runnerUp[scoreField] <= 4));
  return { best, runnerUp, ambiguous, candidates };
}

function selectEdgeListTargetAmbiguity(scored) {
  const candidate = scored
    .filter(item => !item.negated && item.id === "edge_list" && item.targetScore >= 12)
    .sort((a, b) => b.targetScore - a.targetScore || a.start - b.start)[0];
  if (!candidate) return null;
  return {
    type: "EDGE_LIST_EXPORT",
    slot: "target",
    mention: candidate.matchedText,
    segment: candidate.matchedText,
    options: ["incidence", "bipartite", "clique"],
    message: "Edge list can mean incidence memberships, bipartite edges, or clique expansion for export.",
  };
}

function selectJsonTargetAmbiguity(scored) {
  const candidate = scored
    .filter(item => !item.negated && item.id === "json" && item.targetScore >= 12)
    .sort((a, b) => b.targetScore - a.targetScore || a.start - b.start)[0];
  if (!candidate) return null;
  return {
    type: "JSON_EXPORT",
    slot: "target",
    mention: candidate.matchedText,
    segment: candidate.matchedText,
    options: ["canonical", "full_json", "csr_json"],
    message: "JSON can mean canonical JSON, full JSON, or CSR JSON for export.",
  };
}

export function resolveConversionRoles(text) {
  const value = normalizeIntentText(text);
  const mentions = detectFormatMentions(value);
  const { scored, relations } = applyStructuralScores(value, mentions.map(mention => scoreMention(value, mention)));
  const source = selectBest(scored, "source");
  const target = selectBest(scored, "target");
  const edgeListTargetAmbiguity = target.best ? null : selectEdgeListTargetAmbiguity(scored);
  const jsonTargetAmbiguity = target.best ? null : selectJsonTargetAmbiguity(scored);
  const ambiguity = source.ambiguous
    ? {
        type: "SOURCE_FORMAT_AMBIGUOUS",
        slot: "source",
        options: [source.best.inputRoute, source.runnerUp.inputRoute],
        message: `I found multiple possible source formats: ${source.best.label} and ${source.runnerUp.label}.`,
      }
    : target.ambiguous
      ? {
          type: "TARGET_EXPORT_AMBIGUOUS",
          slot: "target",
          options: [target.best.exportId, target.runnerUp.exportId],
          message: `I found multiple possible target exports: ${target.best.label} and ${target.runnerUp.label}.`,
        }
      : edgeListTargetAmbiguity ?? jsonTargetAmbiguity;

  return {
    value,
    mentions,
    scoredMentions: scored,
    source: source.best,
    target: target.best,
    sourceCandidates: source.candidates,
    targetCandidates: target.candidates,
    relations,
    ambiguity,
  };
}

export function resolveSourceFormat(text) {
  const roles = resolveConversionRoles(text);
  if (roles.source) return {
    sourceFormat: roles.source.inputRoute,
    sourceExplicit: true,
    sourceSegment: roles.source.matchedText,
    sourceResolution: "scored_role_cues",
    sourceConfidence: Math.min(1, roles.source.sourceScore / 40),
    sourceMention: roles.source,
  };

  const value = normalizeIntentText(text);
  const commandCanResolveWholeQuery = /\b(?:use|open|select|switch(?:\s+to)?)\b/.test(value);
  const whole = commandCanResolveWholeQuery ? resolveInputRouteAlias(value) : null;
  if (whole) return {
    sourceFormat: whole,
    sourceExplicit: true,
    sourceSegment: cleanSegment(text),
    sourceResolution: "route_command_whole_query",
    sourceConfidence: 0.8,
    sourceMention: null,
  };

  return {
    sourceFormat: null,
    sourceExplicit: false,
    sourceSegment: "",
    sourceResolution: "none",
    sourceConfidence: 0,
    sourceMention: null,
  };
}

export function resolveTargetExport(text) {
  const roles = resolveConversionRoles(text);
  if (roles.target) return {
    targetExport: roles.target.exportId,
    targetExplicit: true,
    targetSegment: roles.target.matchedText,
    targetResolution: "scored_role_cues",
    targetConfidence: Math.min(1, roles.target.targetScore / 40),
    targetMention: roles.target,
  };

  const value = normalizeIntentText(text);
  const mentions = roles.mentions ?? detectFormatMentions(value);
  const multiFormatDisplayOnly = mentions.length > 1
    && /^\s*(?:show|display|view)\b/.test(value)
    && !hasClearConversionIntent(value, mentions);
  const wholeQueryCanBeTarget = !multiFormatDisplayOnly
    && /\b(export|convert\b.*\bto|download|preview|output|give me|show(?: me)?|produce|save as|generate|make)\b/.test(value);
  const whole = wholeQueryCanBeTarget ? resolveExportAlias(value) : null;
  if (whole) return {
    targetExport: whole.id,
    targetExplicit: true,
    targetSegment: cleanSegment(text),
    targetResolution: "whole_query_alias",
    targetConfidence: 0.75,
    targetMention: null,
  };

  return {
    targetExport: null,
    targetExplicit: false,
    targetSegment: "",
    targetResolution: "none",
    targetConfidence: 0,
    targetMention: null,
  };
}

export function isExternalAiPromptRequest(text) {
  return /\b(ai prompt|llm prompt|external ai prompt|claude prompt|chatgpt prompt|gemini prompt|prompt for (?:claude|chatgpt|gemini)|generate (?:a )?prompt)\b/.test(normalizeIntentText(text));
}

export function isBatchUpdatesRequest(text) {
  return /\b(batch updates?|update operations?)\b|\bapply\b.*\bupdates?\b/.test(normalizeIntentText(text));
}

export function isFreeformRequest(text) {
  return /\b(freeform|natural language input|nlp input|nlp conversion)\b/.test(normalizeIntentText(text));
}

export function explicitlyRequestsReparse(text) {
  return /\b(reparse|reload|parse again|replace (?:the )?(?:current )?graph|reload (?:the )?(?:source|dataset|files?))\b/.test(normalizeIntentText(text));
}

export function isGraphPngExportRequest(text) {
  const value = normalizeIntentText(text);
  return /\b(export|download|save)\b.*\b(graph|preview|visuali[sz]ation|image|png)\b.*\bpng\b/.test(value)
    || /\bpng\b.*\b(graph|preview|visuali[sz]ation)\b/.test(value);
}

export function isAmbiguousResetGraphRequest(text) {
  const value = normalizeIntentText(text);
  return /^\s*reset\s+(?:the\s+)?(?:current\s+)?graph[.!?]*\s*$/.test(value)
    || /^\s*reset\s+(?:the\s+)?(?:current\s+)?hypergraph[.!?]*\s*$/.test(value);
}

export function isExplanationRequest(text) {
  const value = normalizeIntentText(text);
  return /\b(what is|what's|explain|meaning of|how does|describe)\b/.test(value)
    || /\bwhat\s+format\s+is\s+(?!this\b|this\s+file\b|the\s+uploaded\b|it\b)/.test(value);
}

export function isAutoDetectRequest(text, resolved = {}) {
  const value = normalizeIntentText(text);
  if (!value) return false;
  const mentionsKnownFormat = Boolean(resolved.explainFormat || resolved.sourceFormat);
  const asksAboutNamedFormat = mentionsKnownFormat && isExplanationRequest(value);
  if (asksAboutNamedFormat) return false;
  return /^auto[- ]?detect(?: format| route)?$/.test(value)
    || /\bauto[- ]?detect\b/.test(value)
    || /\b(detect|identify|recognize|guess)\b.{0,50}\b(format|route|type|file|upload|dataset|this|these|it)\b/.test(value)
    || /\bwhat\s+format\s+is\s+(?:this|this\s+file|the\s+uploaded\s+(?:file|dataset|data)|it)\b/.test(value)
    || /\bwhat\s+type\s+of\s+file\s+is\s+(?:this|it|the\s+uploaded\s+file)\b/.test(value);
}

export function isAmbiguousEdgeListTarget(text, resolved = {}) {
  if (resolved.ambiguity?.type === "EDGE_LIST_EXPORT") return true;
  const roles = resolveConversionRoles(text);
  return roles.ambiguity?.type === "EDGE_LIST_EXPORT";
}

export function resolveVisualizationIntent(text) {
  const raw = String(text ?? "");
  const value = normalizeIntentText(text);
  const viewMode = /\b(line graph|linegraph)\b/.test(value)
    ? "linegraph"
    : /\bhypergraph\s+view\b|\bswitch\s+to\s+hypergraph\b|\bshow\s+the\s+hypergraph\b/.test(value)
      ? "hypergraph"
      : null;
  const layout = /\bcircular\b/.test(value)
    ? "circular"
    : /\bgrid\b/.test(value)
      ? "grid"
      : /\bforce\b/.test(value)
        ? "force"
        : null;
  const limitMatch = value.match(/\b(?:set|change|show|limit|only|first|with|to|use)\b(?:\s+\w+){0,6}?\s+(\d{1,5})\s*(?:hyperedges?|edges?)\b/)
    || value.match(/\b(?:visual(?:ization)?\s+)?limit\s*(?:to|=|at)?\s*(\d{1,5})\b/)
    || value.match(/\b(\d{1,5})\s*(?:hyperedges?|edges?)\b/);
  const limit = limitMatch ? Number(limitMatch[1]) : null;
  const searchMatch = raw.match(/\b(?:search|find|highlight)\s+(?:for\s+)?(?:vertex\s+)?(["']?[\w.-]+["']?)\b/i);
  const searchVertex = searchMatch ? cleanSegment(searchMatch[1]).replace(/^["']|["']$/g, "") : null;
  const resetView = /\b(reset graph view|reset view|reset visualization|reset zoom)\b/.test(value);
  const reheat = /\breheat\b/.test(value);
  const graphPng = isGraphPngExportRequest(value);
  const openPreview = graphPng
    || Boolean(viewMode || layout || limit || searchVertex || resetView || reheat)
    || /\b(show|open|display|view|visuali[sz]e)\b.*\b(graph preview|graph|visuali[sz]ation)\b/.test(value);
  return {
    openPreview,
    viewMode,
    layout,
    limit,
    searchVertex,
    resetView,
    reheat,
    graphPng,
    hasControls: Boolean(viewMode || layout || limit || searchVertex || resetView || reheat),
  };
}

export function resolveCanonicalIntent(userQuery, state = {}) {
  const query = normalizeIntentText(userQuery);
  const roles = resolveConversionRoles(query);
  const sourceAmbiguous = roles.ambiguity?.slot === "source";
  const targetAmbiguous = roles.ambiguity?.slot === "target";
  const emptySource = {
    sourceFormat: null,
    sourceExplicit: false,
    sourceSegment: "",
    sourceResolution: sourceAmbiguous ? "ambiguous" : "none",
    sourceConfidence: 0,
    sourceMention: null,
  };
  const emptyTarget = {
    targetExport: null,
    targetExplicit: false,
    targetSegment: "",
    targetResolution: targetAmbiguous ? "ambiguous" : "none",
    targetConfidence: 0,
    targetMention: null,
  };
  const source = sourceAmbiguous
    ? emptySource
    : roles.source
    ? {
        sourceFormat: roles.source.inputRoute,
        sourceExplicit: true,
        sourceSegment: roles.source.matchedText,
        sourceResolution: "scored_role_cues",
        sourceConfidence: Math.min(1, roles.source.sourceScore / 40),
        sourceMention: roles.source,
      }
    : resolveSourceFormat(query);
  const target = targetAmbiguous
    ? emptyTarget
    : roles.target
    ? {
        targetExport: roles.target.exportId,
        targetExplicit: true,
        targetSegment: roles.target.matchedText,
        targetResolution: "scored_role_cues",
        targetConfidence: Math.min(1, roles.target.targetScore / 40),
        targetMention: roles.target,
      }
    : resolveTargetExport(query);
  const explainFormat = isExplanationRequest(query)
    ? (source.sourceFormat ?? resolveInputRouteAlias(query))
    : null;
  const resolved = {
    query,
    originalQuery: String(userQuery ?? ""),
    ...source,
    ...target,
    targetExportPreview: target.targetExport ? EXPORT_PREVIEWS[target.targetExport] : null,
    explainFormat,
    explanationRequested: Boolean(explainFormat),
    externalAiPrompt: isExternalAiPromptRequest(query),
    batchUpdates: isBatchUpdatesRequest(query),
    freeform: isFreeformRequest(query),
    graphPngExport: isGraphPngExportRequest(query),
    ambiguousResetGraph: isAmbiguousResetGraphRequest(query),
    wantsParseOrConvert: /\b(parse|convert|process|load|read|turn|transform|change|return|write|create|make|produce|generate|export|consume|emit|ingest|serialize|decode|encode|deliver|save|accept|import|publish|yield|render|materialize|interpret)\b/.test(query)
      || Boolean(target.targetExport && /\b(upload|uploaded|file|dataset|data|content|input)\b/.test(query) && /\b(export|output|produce|generate|save|make|create|return|write|emit|deliver|serialize|encode|publish|yield|render)\b/.test(query)),
    requestedReparse: explicitlyRequestsReparse(query),
    visualization: resolveVisualizationIntent(userQuery),
    statsRequested: /\b(stats?|statistics|how many vertices|how many hyperedges|how many incidences)\b/.test(query),
    clearGraphRequested: /\b(clear|delete|remove)\b.*\b(graph|hypergraph|current graph)\b|\bclear graph\b/.test(query),
    mappingsRequested: /\b(show|open|display|view)\b.*\b(?:h2v\/v2h|h2v|v2h|h2h|v2v)?\s*mappings?\b/.test(query),
    exportsRequested: /\b(show|open|display|view)\b.*\bexports?\b|\bopen export options\b|\bwhat formats can i export\b/.test(query),
    runtimeDiagnosticsRequested: /\b(run|show|open|perform)\b.*\b(runtime|diagnostics|ollama|bridge)\b|\bruntime diagnostics\b/.test(query),
    mentions: roles.mentions,
    scoredMentions: roles.scoredMentions,
    relations: roles.relations,
    sourceCandidates: roles.sourceCandidates,
    targetCandidates: roles.targetCandidates,
    ambiguity: roles.ambiguity,
    targetAmbiguity: roles.ambiguity?.slot === "target" ? roles.ambiguity : null,
  };
  resolved.autoDetectRequested = isAutoDetectRequest(query, resolved);
  resolved.ambiguousEdgeListTarget = isAmbiguousEdgeListTarget(query, resolved);
  resolved.currentGraphExport = Boolean(state.hasGraph
    && resolved.targetExport
    && !resolved.sourceExplicit
    && !resolved.requestedReparse
    && !resolved.externalAiPrompt
    && /\b(convert|export|show|give|open|preview|output|save|download|produce|generate|make|return|write|create|emit|deliver|serialize|encode|publish|yield|render|materialize)\b/.test(query));
  return resolved;
}

