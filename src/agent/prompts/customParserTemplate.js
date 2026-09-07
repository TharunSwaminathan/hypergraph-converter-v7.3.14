export const CUSTOM_PARSER_TEMPLATE_VERSION = "custom-parser-template-v1";
export const CUSTOM_PARSER_TEMPLATE = `// Define: async function parseHypergraph(files, helpers)
// files: [{name, text, size, type}]
// helpers: { splitLines, unique, parseDelimited, parseCSV, groupBy, indexBy, splitList }
// Return: array of {id, vertices, time?, weight?}

async function parseHypergraph(files, helpers) {
  const hyperedges = [];
  for (const file of files) {
    const lines = helpers.splitLines(file.text, { comments: true });
    for (const line of lines) {
      const ci = line.indexOf(":");
      if (ci === -1) continue;
      const id = line.slice(0, ci).trim();
      const vertices = line.slice(ci + 1).trim().split(/[\\s,]+/).filter(Boolean);
      hyperedges.push({ id, vertices, time: null, weight: 1 });
    }
  }
  return hyperedges;
}`;
