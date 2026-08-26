import assert from "node:assert/strict";
import { isHelpSeekingQuestionText, helpSeekingMentionsActionCommand, helpSeekingTopic } from "../src/agent/deterministicNlu/helpSeekingGuards.js";

const helpPhrases = [
  "Show me how to clear the graph",
  "Please show me how to clear the graph",
  "Can you show me how to clear the graph",
  "Could you tell me how to clear the graph",
  "Tell me how to clear the graph",
  "I want to know how to clear the graph",
  "I need instructions to clear the graph",
  "What are the steps to clear the graph",
  "What command should I use to clear the graph",
  "Where do I go to clear the graph",
  "What do I type to clear the graph",
  "Walk me through how to clear the graph",
];

for (const text of helpPhrases) {
  assert.equal(isHelpSeekingQuestionText(text), true, text);
  assert.equal(helpSeekingMentionsActionCommand(text), true, text);
  assert.match(helpSeekingTopic(text), /clear the graph/i, text);
}

const directPhrases = [
  "Can you show me the graph?",
  "Show me the graph",
  "Please clear the graph",
  "Clear the graph",
  "Could you clear the graph?",
  "Stop the current request",
];

for (const text of directPhrases) {
  assert.equal(isHelpSeekingQuestionText(text), false, text);
}

console.log("deterministic Help phrase-family tests passed.");
