#!/usr/bin/env node
// Fails early, with a readable message, when Node.js is older than what Vite 8 needs.
// Used by the macOS/Linux launchers so an old Homebrew/system Node does not surface
// as a cryptic Vite stack trace. Required range mirrors package.json "engines".
const [major, minor] = process.versions.node.split(".").map(Number);
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
if (!ok) {
  console.error(`Node.js ${process.versions.node} is too old for this project.`);
  console.error("Install Node.js 20.19+ or 22.12+ (https://nodejs.org, or: brew install node), reopen the terminal, and try again.");
  process.exit(1);
}
