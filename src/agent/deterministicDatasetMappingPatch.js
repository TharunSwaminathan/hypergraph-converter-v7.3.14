import { analyzeDeterministicNlu } from "./deterministicNlu/deterministicNlu.js";
import { compileDatasetMappingGrammar } from "./deterministicNlu/domains/datasetMappingGrammar.js";
import { buildDatasetMappingReferenceContext } from "./datasetMappingReferenceResolver.js";

function normalizeText(text = "") {
  return String(text ?? "").replace(/\r\n?/g, "\n").trim();
}

export function buildDeterministicDatasetMappingPatch(text = "", {
  batch = null,
  mappingSpec = null,
  datasetProfile = null,
  nlu = null,
} = {}) {
  const raw = normalizeText(text);
  if (!raw || !mappingSpec || mappingSpec.version !== 2) {
    return {
      ok: false,
      noMatch: true,
      diagnostics: {
        plannerPath: "deterministic_nlu",
        authoritativeCompiler: "dataset_mapping_v1",
        legacyParserCalled: false,
      },
      error: "A validated DatasetMappingSpec v2 is required before building a typed mapping patch.",
    };
  }

  const context = buildDatasetMappingReferenceContext({ batch, datasetProfile, mappingSpec });
  const analysis = nlu ?? analyzeDeterministicNlu(raw, {
    datasetMapping: context,
    parserWorkflow: {
      mappingStatus: batch?.mappingSpecStatus ?? "unknown",
      planStatus: batch?.transformationPlanStatus ?? "none",
      parserStatus: batch?.parserStatus ?? "none",
      resultStatus: batch?.parserRunResult?.passed ? "preview" : "none",
    },
  });

  const compiled = compileDatasetMappingGrammar(raw, {
    nlu: analysis,
    batch,
    mappingSpec,
    datasetProfile,
  });

  if (compiled.ok && !compiled.noMatch) {
    return {
      ...compiled,
      diagnostics: {
        ...(compiled.diagnostics ?? {}),
        authoritativeCompiler: "dataset_mapping_v1",
        legacyParserCalled: false,
        modelCalled: false,
        genericActionPlannerCalled: false,
      },
    };
  }

  return {
    ok: false,
    noMatch: true,
    diagnostics: {
      plannerPath: "deterministic_nlu",
      authoritativeCompiler: "dataset_mapping_v1",
      legacyParserCalled: false,
      modelCalled: false,
      genericActionPlannerCalled: false,
      nluDomain: analysis.primaryDomain,
      nluIntent: analysis.primaryIntent,
      nluConfidence: analysis.confidence,
      nluTrace: analysis.trace,
    },
  };
}

export function formatDatasetMappingPatchSummary({
  spec,
  applied = null,
  noChange = false,
  fallbackUsed = false,
  modelAttempted = false,
  bootstrapGenerated = false,
} = {}) {
  if (noChange) return "The active mapping already matches that guidance.";
  const activeSpec = spec ?? applied?.spec ?? {};
  const lines = [];
  if (fallbackUsed && modelAttempted) {
    lines.push("The local mapping planner did not return a valid typed patch, so I used the deterministic NLU compiler.");
  } else if (fallbackUsed) {
    lines.push("I used the deterministic NLU compiler for this mapping patch.");
  }
  if (bootstrapGenerated) lines.push("A DatasetMappingSpec v2 base was bootstrapped from the active dataset profile first.");
  lines.push(`Mapping revision ${activeSpec.mappingRevision ?? "?"} is active.`);

  const files = (activeSpec.files ?? []).filter(file => file.useAsInput || file.role !== "unknown");
  if (files.length) {
    lines.push("");
    lines.push("Files");
    for (const file of files) {
      const key = (file.keyColumns ?? []).length ? `; key: ${file.keyColumns.join(" + ")}` : "";
      lines.push(`- ${file.fileName}: ${file.role}${key}`);
    }
  }

  const relationships = activeSpec.relationships ?? [];
  if (relationships.length) {
    lines.push("");
    lines.push("Relationships");
    for (const rel of relationships) {
      lines.push(`- ${rel.sourceFile}.${(rel.sourceColumns ?? []).join(" + ")} -> ${rel.targetFile}.${(rel.targetColumns ?? []).join(" + ")}`);
      if ((rel.vertexColumns ?? []).length) lines.push(`  vertices from ${rel.vertexSourceFile}.${rel.vertexColumns.join(" + ")}`);
    }
  }

  const policies = activeSpec.policies ?? {};
  const policyLines = [];
  if (policies.unmatchedHyperedgeRows === "preserve_empty") policyLines.push("preserve unmatched hyperedge rows");
  if (policies.emptyHyperedges === "keep") policyLines.push("keep empty hyperedges");
  if (policies.duplicateMembership === "deduplicate") policyLines.push("deduplicate memberships");
  if (policyLines.length) {
    lines.push("");
    lines.push("Policies");
    for (const policy of policyLines) lines.push(`- ${policy}`);
  }

  if (applied?.diff?.length) {
    lines.push("");
    lines.push(`Diff: ${applied.diff.join(" ")}`);
  }
  lines.push("");
  lines.push("No parser code was run and the graph was not changed.");
  return lines.join("\n");
}
