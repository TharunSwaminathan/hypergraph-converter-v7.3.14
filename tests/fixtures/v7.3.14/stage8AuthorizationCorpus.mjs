import { V7_3_13_READONLY_FRAMES } from "../../../scripts/verify-v7-3-13-readonly-safety.mjs";
import { normalizeEmbeddedCommand } from "../../../scripts/deterministicSafetyMatrix.mjs";

const lower = normalizeEmbeddedCommand;

// These twenty frames complete the inherited 60-frame/9,840-case safety
// corpus characterized before Stage 8. They intentionally exercise the C01
// wording families that were not present in the committed 40-frame gate.
export const STAGE8_C01_CHARACTERIZATION_FRAMES = Object.freeze({
  trailing_reference_only: command => `${command} -- for reference only.`,
  trailing_information_only: command => `${command}; this is information only.`,
  parenthetical_report: command => `(A reviewer mentioned ${lower(command)}.) Explain the statement.`,
  third_person_report: command => `A teammate suggested that I ${lower(command)}; I am only reporting it.`,
  read_as_text: command => `Read this as text: ${command}`,
  capability_can_i: command => `Can I ${lower(command)}?`,
  capability_possible: command => `Is it possible to ${lower(command)}?`,
  counterfactual: command => `If I had chosen to ${lower(command)}, what would have happened?`,
  future_plan: command => `I plan to ${lower(command)} another day; explain the consequences now.`,
  first_person_dont_want: command => `I don't want you to ${lower(command)}; just explain it.`,
  first_person_not_asking: command => `I am not asking you to ${lower(command)}.`,
  first_person_understand: command => `I only want to understand whether I can ${lower(command)}.`,
  workspace_untouched: command => `Keep the workspace untouched; ${command}`,
  unicode_read_quote: command => `Read ‘${command}’ as text, without acting.`,
  data_contains: command => `My imported data contains the line: ${command}`,
  dash_report: command => `The test fixture contains this instruction — ${command} — please analyze the wording.`,
  comparison_alternative: command => `Compare the result of ${lower(command)} against preserving the workspace.`,
  consequence_question: command => `What are the consequences if someone decides to ${lower(command)}?`,
  procedure_indirect: command => `Which procedure would a user follow to ${lower(command)}?`,
  no_authority_trailing: command => `${command}; I am not authorizing that operation.`,
});

export const STAGE8_EXISTING_60_READONLY_FRAMES = Object.freeze({
  ...V7_3_13_READONLY_FRAMES,
  ...STAGE8_C01_CHARACTERIZATION_FRAMES,
});

// An independently worded held-out set. Production code never imports this
// module; the vocabulary is deliberately different from implementation
// evidence strings so the gate does not merely replay its own patterns.
export const STAGE8_NEW_40_READONLY_FRAMES = Object.freeze({
  archivist_note: command => `Archive note (${command}) -- discuss, don't perform.`,
  audit_suffix: command => `${command} [audit transcript, not consent]`,
  book_excerpt: command => `An excerpt reads “${command}”; interpret the excerpt.`,
  capability_plain: command => `Would a person be able to ${lower(command)}?`,
  capability_permission: command => `Am I allowed to ${lower(command)}?`,
  conditional_outcome: command => `Were somebody to ${lower(command)}, what outcome should they expect?`,
  counterfactual_past: command => `Had we ${lower(command)}, how would the workspace differ?`,
  delayed_possibility: command => `Perhaps next week I will ${lower(command)}; for now, describe it.`,
  denial_fronted: command => `Without granting permission, consider: ${command}`,
  denial_parenthetical: command => `${command} (permission is expressly withheld).`,
  denial_trailing: command => `${command} -- that is not an instruction for you.`,
  docs_backtick: command => "The handbook prints `" + command + "`; summarize that entry.",
  example_brackets: command => `Example input [${command}] should be treated as literal data.`,
  fenced_sample: command => "Review the following specimen:\n```text\n" + command + "\n```",
  first_person_decline: command => `I decline to approve ${lower(command)}; explain the tradeoff.`,
  first_person_learning: command => `My goal is learning, not action: how would one ${lower(command)}?`,
  future_intention: command => `I intend to ${lower(command)} eventually, but not in this session.`,
  glossary: command => `Glossary question: what is meant by “${command}”?`,
  hypothetical_imperative: command => `Imagine a user said ${command}; what would the app propose?`,
  indirect_consequence: command => `Describe the state transition associated with ${lower(command)}.`,
  keep_exact: command => `Keep every product-state field exactly as-is while explaining: ${command}`,
  leave_session: command => `${command}; leave this session unmodified.`,
  literal_command: command => `Treat these words literally rather than operationally: ${command}`,
  meaning_dash: command => `Meaning request — ${command}`,
  model_quote: command => `A model output said '${command}'. Is that safe?`,
  no_consent_unicode: command => `No consent—${command}—only assess the wording.`,
  no_execution_parenthetical: command => `${command} (execution is outside the scope of this request).`,
  no_workspace_write: command => `Do not write to the workspace. Instead, explain ${lower(command)}.`,
  possibility_question: command => `Might ${lower(command)} be supported?`,
  procedure_for_others: command => `How would another operator ${lower(command)}?`,
  quoted_curly: command => `Please decode “${command}” as a sentence.`,
  quoted_single_unicode: command => `The phrase ‘${command}’ is evidence, not an order.`,
  reported_colon: command => `Incident log: an operator typed ${command}`,
  reported_semicolon: command => `The observer recorded this; ${command}; no action was requested.`,
  research_question: command => `For a usability study, why might someone ${lower(command)}?`,
  state_preservation_trailing: command => `${command}; retain all current application state.`,
  syntax_only_alt: command => `What notation expresses the operation ${lower(command)}?`,
  teaching_request: command => `Teach a novice about ${lower(command)} without doing it.`,
  third_party_request: command => `Someone else asked, “${command}”; I am relaying the quote.`,
  unicode_semicolon: command => `Analyze only；${command}；the workspace must remain untouched.`,
});

export const STAGE8_MIXED_TEMPLATES = Object.freeze([
  command => `Explain the format first. Then ${command}`,
  command => `${command} Then explain what was staged.`,
  command => `The manual says “do nothing”. Then ${command}`,
  command => `What does the related feature mean? After that, ${command}`,
  command => `For context, no action is requested by this sentence. Separately, ${command}`,
  command => `${command} Afterward, show the current status.`,
  command => `Explain H2V, and then ${command}`,
]);

export const STAGE8_PENDING_READONLY_QUERIES = Object.freeze([
  "Explain the pending change.",
  "What happens if I change 6 to 7?",
  "How do I change the pending vertex from 6 to 7?",
  "I'm reviewing 'change the pending vertex from 6 to 7'.",
  "Do not change the pending vertex from 6 to 7.",
  "Keep the pending action exactly as it is.",
  "Can I change the pending vertex?",
  "Read this as text: change the pending vertex from 6 to 7.",
  "Change the pending vertex from 6 to 7 -- for reference only.",
  "A reviewer suggested change the pending vertex from 6 to 7; no action please.",
]);

export const STAGE8_PENDING_CORRECTIONS = Object.freeze([
  "Change the pending vertex from 6 to 7.",
  "Use h3 instead of h2 in the pending graph edit.",
  "Replace author_id with researcher_id in the pending mapping.",
]);
