import { parse } from 'acorn';
import { validateParserCodeSafety } from '../src/utils/customParser.js';
import { validateSelectedFiles } from '../src/agent/uploadPolicy.js';

// Parse and static-validation only: never run parser code or contact a URL.
const code = 'async function parseHypergraph(files, helpers) { const module = await import("data:text/javascript,export default 1"); return []; }';
const ast = parse(code, { ecmaVersion: 'latest' });
const importExpression = ast.body[0].body.body[0].declarations[0].init.argument;
const safety = validateParserCodeSafety(code);
const duplicateNames = validateSelectedFiles([
  { name: 'same.csv', size: 3 },
  { name: 'same.csv', size: 5 },
]).map(file => file.name);
console.log(JSON.stringify({ importNodeType: importExpression.type, safety, duplicateNames }, null, 2));
