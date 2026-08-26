import { findExportPreview, findRoute } from "./routeRegistry.js";

import { helpSeekingTopic, isHelpSeekingQuestionText } from "./deterministicNlu/helpSeekingGuards.js";

const normalize = text => String(text ?? "")
  .toLowerCase()
  .replace(/[’]/g, "'")
  .replace(/\s+/g, " ")
  .trim();

export function classifyIntent(text) {
  const raw = String(text ?? "").trim();
  const normalized = normalize(text);
  const route = findRoute(normalized);
  const exportPreview = findExportPreview(normalized);
  const result = { intent: "unknown", normalized, route, exportPreview };

  if (!normalized) return result;
  if (isHelpSeekingQuestionText(raw)) {
    return { ...result, intent: "help_query", helpTopic: helpSeekingTopic(raw) };
  }

  // Never guess the target of short destructive or executable commands.
  if (/^(clear|delete|remove|reset) (this|it|that)(?: please)?[.!?]*$/.test(normalized)) {
    return { ...result, intent: "ambiguous_clear" };
  }
  if (/^(run|apply|use|do|process|convert) (it|this|that|these)(?: now| please)?[.!?]*$/.test(normalized)) {
    return { ...result, intent: "ambiguous_action" };
  }

  const generateForBatch = normalized.match(/\b(?:generate|create)\s+(?:a\s+)?(?:custom\s+)?parser\s+for\s+batch\s+(\d+)\b/);
  if (generateForBatch) {
    return { ...result, intent: "generate_parser_for_batch", batchNumber: Number(generateForBatch[1]) };
  }
  const activateBatch = normalized.match(/\b(?:switch to|activate|use|select)\s+batch\s+(\d+)\b/);
  if (activateBatch) {
    return { ...result, intent: "activate_batch_number", batchNumber: Number(activateBatch[1]) };
  }
  if (/^(?:use|activate|select)\s+(?:this|the active|current)\s+batch[.!?]*$/.test(normalized)) {
    return { ...result, intent: "use_active_batch" };
  }

  if (/\b(generate|create)\b.*\bparser\b.*\bfrom\b.*\bmapping\b/.test(normalized)) {
    return { ...result, intent: "generate_parser_from_mapping" };
  }
  if (/\b(?:infer|generate|create)\b.*\bmapping\b.*\bwithout (?:a )?model\b|\bgenerate deterministic mapping\b/.test(normalized)) {
    return { ...result, intent: "generate_deterministic_mapping" };
  }
  if (/\b(?:auto[- ]?repair|repair)\b.*\bmapping\b(?!.*local model)/.test(normalized)) {
    return { ...result, intent: "auto_repair_mapping" };
  }
  if (/\buse\b.*\bdeterministic draft\b/.test(normalized)) {
    return { ...result, intent: "use_deterministic_draft" };
  }
  if (/\buse\b.*\brepaired mapping\b/.test(normalized)) {
    return { ...result, intent: "use_repaired_mapping" };
  }
  if (/\bshow\b.*\brepair notes?\b/.test(normalized)) {
    return { ...result, intent: "show_repair_notes" };
  }
  if (/\b(generate|create|infer)\b.*\b(?:dataset )?mapping(?: spec)?\b|\bmap (?:this|these) files\b/.test(normalized)) {
    return { ...result, intent: "generate_mapping_spec" };
  }
  if (/\b(repair|fix)\b.*\bmapping spec\b.*\blocal model\b/.test(normalized)) {
    return { ...result, intent: "repair_mapping_spec" };
  }
  if (/\b(validate|check)\b.*\bmapping(?: spec)?\b/.test(normalized)) {
    return { ...result, intent: "validate_mapping" };
  }
  if (/\b(edit|correct|change)\b.*\bmapping(?: spec)?\b/.test(normalized)) {
    return { ...result, intent: "edit_mapping" };
  }
  if (/\b(explain|show|describe)\b.*\bmapping(?: spec)?\b/.test(normalized)) {
    return { ...result, intent: "explain_mapping" };
  }
  if (/\bcompare\b.*\bexpected(?: output)?\b|\bvalidate\b.*\bexpected(?: output)?\b/.test(normalized)) {
    return { ...result, intent: "compare_expected_output" };
  }
  if (/\bexport\b.*\b(mapping|fine[- ]?tun(?:e|ing))\b.*\b(example|data|json)?\b/.test(normalized)) {
    return { ...result, intent: "export_mapping_finetune" };
  }
  if (/\baccept\b.*\bmapping\b/.test(normalized)) {
    return { ...result, intent: "accept_mapping" };
  }
  if (/\breject\b.*\bmapping\b/.test(normalized)) {
    return { ...result, intent: "reject_mapping" };
  }
  if (/\b(use|start|open)\b.*\bmapping(?: spec)? workflow\b/.test(normalized)) {
    return { ...result, intent: "use_mapping_workflow" };
  }

  if (/\b(github pages setup|github pages help|deployed setup|deployment help)\b.*\b(model|ollama|runtime|bridge)?\b/.test(normalized)) {
    return { ...result, intent: "local_runtime_setup_help" };
  }
  if (/\b(run|show|open|perform)\b.*\b(runtime|local model|ollama)?\s*diagnostics\b|\bruntime diagnostics\b/.test(normalized)) {
    return { ...result, intent: "local_runtime_diagnostics" };
  }
  if (/\btest\b.*\bbridge\b|\blocal runtime bridge\b.*\btest\b/.test(normalized)) {
    return { ...result, intent: "local_runtime_test_bridge" };
  }
  if (/\btest\b.*\bsimple generation\b|\bgeneration test\b/.test(normalized)) {
    return { ...result, intent: "local_runtime_test_generation" };
  }
  if (/\btest\b.*\bdirect ollama\b/.test(normalized)) {
    return { ...result, intent: "local_runtime_test_direct_ollama" };
  }
  if (/\b(use|prefer|try)\b.*\bollama\b.*\bbridge\b|\bprefer\b.*\bbridge\b/.test(normalized)) {
    return { ...result, intent: "local_model_reconnect_bridge" };
  }

  if (/\b(disconnect|disable|turn off|stop)\b.*\blocal (?:model|assistant)(?: assist)?\b/.test(normalized)) {
    return { ...result, intent: "local_model_disable" };
  }
  if (/\blocal (?:model|assistant) status\b|\bstatus of (?:the )?local (?:model|assistant)\b|\bshow\b.*\bconnection details\b/.test(normalized)) {
    return { ...result, intent: "local_model_status" };
  }
  if (/\b(?:connect|reconnect)\b.*\b(?:ollama|local model|local assistant|model)\b|\bconnect\b|\breconnect\b/.test(normalized)) {
    return { ...result, intent: "local_model_connect" };
  }
  if (/\btest\b.*\b(ollama|local model|model connection)\b|\btest ollama connection\b/.test(normalized)) {
    return { ...result, intent: "local_model_test" };
  }
  if (/\b(?:is|check|verify|list|show)\b.*\bqwen3:8b\b.*\b(installed|available|present|models?)\b|\blist\b.*\b(local )?models\b|\bshow ollama models\b/.test(normalized)) {
    return { ...result, intent: "local_model_list" };
  }
  const modelName = raw.match(/^use model\s+(.+?)[.!?]*$/i);
  if (modelName) {
    return { ...result, intent: "local_model_select", modelName: modelName[1].trim() };
  }
  if (/\b(generate|create)\b.*\bparser\b.*\blocal model\b|\blocal model\b.*\b(generate|create)\b.*\bparser\b/.test(normalized)) {
    return { ...result, intent: "local_model_generate_parser" };
  }
  if (/\b(explain|analy[sz]e|identify)\b.*\bfile roles?\b.*\blocal model\b|\blocal model\b.*\bfile roles?\b/.test(normalized)) {
    return { ...result, intent: "local_model_analyze_roles" };
  }
  if (/\brepair\b.*\bparser\b.*\blocal model\b|\blocal model\b.*\brepair\b.*\bparser\b/.test(normalized)) {
    return { ...result, intent: "local_model_repair_parser" };
  }
  if (/\bexplain\b.*\bparser strategy\b.*\blocal model\b|\blocal model\b.*\bparser strategy\b/.test(normalized)) {
    return { ...result, intent: "local_model_explain_strategy" };
  }
  if (/\b(use|enable|turn on)\b.*\blocal model(?: assist)?\b/.test(normalized)) {
    return { ...result, intent: "local_model_enable" };
  }

  if (/\b(clear|reset|remove|delete)\b.*\b(graph|hypergraph|current graph)\b|\bclear graph\b/.test(normalized)) {
    return { ...result, intent: "clear_graph_request" };
  }
  if (/\b(batch updates?|update operations?)\b|\bapply\b.*\bupdates?\b/.test(normalized)) {
    return { ...result, intent: "batch_updates_placeholder" };
  }
  if (/\b(freeform|natural language input|nlp input|nlp conversion)\b/.test(normalized)) {
    return { ...result, intent: "freeform_placeholder" };
  }
  if (/\b(ai prompt|llm prompt|external ai prompt|claude prompt|chatgpt prompt|gemini prompt|prompt for (?:claude|chatgpt|gemini)|generate (?:a )?prompt)\b/.test(normalized)) {
    return { ...result, intent: "external_ai_prompt" };
  }
  if (/\b(show|open|display|view)\b.*\b(?:h2v\/v2h|h2v|v2h|h2h|v2v)?\s*mappings?\b/.test(normalized)) {
    return { ...result, intent: "show_mappings" };
  }
  if (/\b(show|open|display|view)\b.*\bgraph preview\b|\bvisuali[sz]e\b.*\bgraph\b/.test(normalized)) {
    return { ...result, intent: "show_graph_preview" };
  }
  if (/\b(show|open|display|view)\b.*\bexports?\b|\bopen export options\b|\bwhat formats can i export\b/.test(normalized)) {
    return { ...result, intent: "show_exports" };
  }
  if (/\b(export|convert|download|save|output|make)\b.*\bedge list\b/.test(normalized)
    && !/\b(incidence|bipartite|clique|pairwise|graph edge list|size[- ]?two)\b/.test(normalized)) {
    return { ...result, intent: "ambiguous_edge_list_export" };
  }
  if (/\b(apply|load|use)\b.*\b(custom )?parser result\b|\bapply result\b/.test(normalized)) {
    return { ...result, intent: "apply_custom_parser_request" };
  }
  if (/\b(run|execute|start|test)\b.*\b(custom )?parser\b|\brun my parser\b/.test(normalized)) {
    return { ...result, intent: "run_custom_parser_request" };
  }

  // Export wins over input-route words such as CSR, JSON, and CSV.
  if (/\b(export|preview|output|save|download)\b/.test(normalized) && exportPreview) {
    return { ...result, intent: "select_export_preview" };
  }
  if (/\b(export|preview|output format|download)\b/.test(normalized)) {
    return { ...result, intent: "export_guidance" };
  }

  if (/\b(add|merge|append)\b.*\b(previous|prior|last)\b.*\bbatch\b|\badd (?:these|this|active) files? to (?:the )?previous\b/.test(normalized)) {
    return { ...result, intent: "add_to_previous_batch" };
  }
  if (/\b(view|show|open|use|select)\b.*\b(previous|prior|last)\b.*\bbatch\b/.test(normalized)) {
    return { ...result, intent: "view_previous_batch" };
  }
  if (/\b(clear|delete|remove)\b.*\b(previous|prior|last)\b.*\bbatch\b/.test(normalized)) {
    return { ...result, intent: "clear_previous_batch" };
  }
  if (/\b(clear|delete|remove)\b.*\ball\b.*\b(?:upload )?batches\b/.test(normalized)) {
    return { ...result, intent: "clear_all_batches" };
  }
  if (/\b(parse|treat|combine|join)\b.*\b(together|one dataset|single dataset|temporal dataset)\b|^together as one dataset[.!?]*$|\bthese files belong together\b|\bcombine these files\b/.test(normalized)) {
    return { ...result, intent: "parse_together" };
  }
  if (/\b(parse|treat|keep)\b.*\b(separately|separate datasets?|individual(?:ly)?)\b|^separate datasets?[.!?]*$|\beach file is (?:its own|a separate) graph\b/.test(normalized)) {
    return { ...result, intent: "parse_separately" };
  }
  if (/\b(explain|show|identify)\b.*\b(file roles?|roles? of (?:these|the) files?)\b/.test(normalized)) {
    return { ...result, intent: "explain_file_roles" };
  }
  if (/\b(use|treat|keep)\b.*\b(new|active|current)\b.*\bdataset\b/.test(normalized)) {
    return { ...result, intent: "use_as_new_dataset" };
  }
  if (/\b(compare|difference between)\b.*\b(datasets?|batches)\b/.test(normalized)) {
    return { ...result, intent: "compare_datasets" };
  }
  if (/\b(which format|what format should|should i use|difference between)\b/.test(normalized)) {
    return { ...result, intent: "compare_formats" };
  }

  if (/\b(clear|remove|delete|detach)\b.*\b(uploaded|attached|active|agent)?\s*(files?|batch)\b/.test(normalized)) {
    return { ...result, intent: "clear_uploaded_files" };
  }
  if (/^(upload|attach|add)\b.*\bfiles?\b|\b(upload|attach) files?\b/.test(normalized)) {
    return { ...result, intent: "upload_files" };
  }
  if (/\b(use|send|route)\b.*\b(files?|uploads?|attachments?|these)\b.*\bcustom parser\b|\bcustom parser\b.*\b(files?|uploads?|attachments?)\b/.test(normalized)) {
    return { ...result, intent: "use_uploaded_files_with_custom_parser" };
  }
  if (/\b(auto[- ]?detect|detect|identify)\b.*\b(files?|uploads?|attachments?|this|these|it)\b|\b(files?|uploads?|attachments?)\b.*\b(auto[- ]?detect|detect|identify)\b|^auto[- ]?detect(?: format)?$/.test(normalized)) {
    return { ...result, intent: "auto_detect_uploaded_files" };
  }
  if (/\b(parse|convert|process)\b.*\b(files?|uploads?|attachments?|attached|this|these)\b|\bparse this\b|\bparse with (?:the )?current route\b/.test(normalized)) {
    return { ...result, intent: "parse_uploaded_files", useCurrentRoute: /\bcurrent route\b/.test(normalized) };
  }
  if (/\bwhat format\b.*\b(files?|uploads?|attachments?|these)\b|\bexplain\b.*\b(detected format|uploaded files?|attachments?)\b/.test(normalized)) {
    return { ...result, intent: "explain_uploaded_files" };
  }
  if (route && /\b(send|route|use)\b.*\b(files?|uploads?|attachments?|these)\b/.test(normalized)) {
    return { ...result, intent: "route_uploaded_files" };
  }

  const visualLimit = normalized.match(/\b(?:set|change|update|show|limit|only|first)\b(?:\s+\w+){0,4}?\s+(\d{1,5})\s*(?:hyperedges?|edges?)?\b/);
  if (visualLimit && /\b(limit|visual|show|only|first|edges?|hyperedges?)\b/.test(normalized)) {
    return { ...result, intent: "change_visual_limit", value: Number(visualLimit[1]) };
  }
  if (/\b(show|give|display|open|what are|current)\b.*\b(stats?|statistics)\b|\bhow many (?:vertices|hyperedges|incidences)\b/.test(normalized)) {
    return { ...result, intent: "show_stats" };
  }
  if (/\b(help|guide|guidance|how|generate|create)\b.*\b(custom parser|parser code|multiple files?)\b|\bgenerate parser guidance\b/.test(normalized)) {
    return { ...result, intent: "custom_parser_guidance" };
  }
  if (/\bdiagnos\w*\b|\b(upload|file)\b.*\b(not updating|not working|error|failed|stale|refresh)\b|\b(error|not working|failed|slow)\b/.test(normalized)) {
    return { ...result, intent: "diagnose_error" };
  }
  if (/\b(help|how|guide|guidance)\b.*\b(upload|parse|convert|input|file)\b/.test(normalized)) {
    return { ...result, intent: "parse_guidance" };
  }
  if (/\b(visual|graph preview|zoom|layout)\b/.test(normalized) && /\b(help|how|show|open|use|guide)\b/.test(normalized)) {
    return { ...result, intent: "visualization_guidance" };
  }
  if (/\b(what is|what's|explain|meaning of|how does)\b/.test(normalized) && route) {
    return { ...result, intent: "explain_concept" };
  }
  if (/\b(use|open|switch|select|go to|take me to|choose|show me)\b/.test(normalized) && route) {
    return { ...result, intent: "switch_tab" };
  }
  if (/^(help|commands|what can you do|how can you help)\??$/.test(normalized)) {
    return { ...result, intent: "help" };
  }

  return result;
}

