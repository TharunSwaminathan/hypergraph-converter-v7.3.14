import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { normalizeEmbeddedCommand, runReadOnlySafetyMatrix } from "./deterministicSafetyMatrix.mjs";

const normalize = normalizeEmbeddedCommand;
export const COMPOSITIONAL_HELP_FRAMES = Object.freeze({
  wondering_how: command => `I was wondering how to ${normalize(command)}.`,
  explain_steps: command => `Explain the steps to ${normalize(command)}.`,
  give_instructions_how: command => `Give me instructions on how to ${normalize(command)}.`,
  help_understand_how: command => `Help me understand how to ${normalize(command)}.`,
  describe_how: command => `Please describe how to ${normalize(command)}.`,
  tell_what_type: command => `Could you tell me what to type to ${normalize(command)}?`,
  teach_how: command => `Teach me how to ${normalize(command)}.`,
  like_walkthrough: command => `I would like a walkthrough for how to ${normalize(command)}.`,
  procedure_explain: command => `What is the procedure for how to ${normalize(command)}?`,
  before_anything: command => `Before doing anything, tell me how to ${normalize(command)}.`,
  without_changing: command => `Without changing anything, explain how to ${normalize(command)}.`,
  just_command: command => `I just want to know the command to ${normalize(command)}.`,
  trying_learn: command => `I am trying to learn how to ${normalize(command)}.`,
  question_about: command => `I have a question about how to ${normalize(command)}.`,
  training: command => `For training purposes, explain how to ${normalize(command)}.`,
  show_syntax: command => `Show me the syntax to ${normalize(command)}.`,
  appreciate_instructions: command => `I would appreciate instructions for how to ${normalize(command)}.`,
  need_guidance: command => `I need guidance on how to ${normalize(command)}.`,
  tutorial: command => `Give me a tutorial on how to ${normalize(command)}.`,
  documentation: command => `Document the steps for how to ${normalize(command)}.`,
  explain_only: command => `Explain only: how to ${normalize(command)}.`,
  best_way: command => `What is the best way to ${normalize(command)}?`,
  process_for: command => `What is the process for ${normalize(command)}?`,
  steps_involved: command => `What steps are involved in trying to ${normalize(command)}?`,
  guidance_on: command => `Could I get guidance on ${normalize(command)}?`,
  walkthrough_bare: command => `Walk me through ${normalize(command)}.`,
  is_there_way: command => `Is there a way to ${normalize(command)}?`,
  button_click: command => `What button do I click to ${normalize(command)}?`,
  menu_lets: command => `Which menu lets me ${normalize(command)}?`,
  find_option: command => `Where can I find the option to ${normalize(command)}?`,
  outline_how: command => `Could you outline how to ${normalize(command)}?`,
  do_you_know: command => `Do you know how to ${normalize(command)}?`,
  hypothetical_how: command => `Hypothetically, how would I ${normalize(command)}?`,
  need_to_do: command => `What do I need to do to ${normalize(command)}?`,
  what_enter: command => `What should I enter to ${normalize(command)}?`,
  how_done: command => `How is ${normalize(command)} done?`,
  how_does_one: command => `How does one ${normalize(command)}?`,
  someone_explain: command => `Can someone explain how to ${normalize(command)}?`,
  manual_entry: command => `What exact command should I manually enter to ${normalize(command)}?`,
  locate_control: command => `Where is the control that would let me ${normalize(command)}?`,
});

export function runCompositionalHelpSafetyMatrix() {
  return runReadOnlySafetyMatrix(COMPOSITIONAL_HELP_FRAMES);
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const outputPath = resolve(process.argv[2] ?? "artifacts/v7.3.10-compositional-help-safety-report.json");
  const report = await runCompositionalHelpSafetyMatrix();
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, allFailures: report.allFailures.slice(0, 20) }, null, 2));
  if (report.failures) process.exitCode = 1;
}
