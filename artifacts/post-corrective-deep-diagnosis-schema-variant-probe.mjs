// Diagnosis only: probes Ollama's operation-specific JSON Schema handling.
import { writeFile } from 'node:fs/promises';

const endpoint = 'http://127.0.0.1:11434/api/chat';
const operation = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['type', 'vertexReference', 'hyperedgeReference'], properties: {
      type: { type: 'string', enum: ['ADD_INCIDENCE'] }, vertexReference: { type: 'string' }, hyperedgeReference: { type: 'string' },
    } },
    { type: 'object', additionalProperties: false, required: ['type'], properties: { type: { type: 'string', enum: ['CLEAR_GRAPH'] } } },
  ],
};
const schema = { type: 'object', additionalProperties: false, required: ['operation'], properties: { operation } };
const rows = [];
for (const [family, prompt] of [
  ['ADD_INCIDENCE', 'Return the JSON operation for adding vertex Alice to hyperedge h1.'],
  ['CLEAR_GRAPH', 'Return the JSON operation for clearing the graph.'],
]) {
  for (let trial = 1; trial <= 3; trial++) {
    const started = performance.now();
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        model: 'qwen3:8b', stream: false, think: false, format: schema, keep_alive: '5m', options: { temperature: 0, num_predict: 250 },
        messages: [{ role: 'system', content: 'Return one JSON object matching the supplied schema. No prose.' }, { role: 'user', content: prompt }],
      }) });
      const data = await response.json();
      const text = data.message?.content ?? '';
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      const op = parsed?.operation;
      const keys = op && typeof op === 'object' ? Object.keys(op) : [];
      const expected = family === 'ADD_INCIDENCE' ? ['type', 'vertexReference', 'hyperedgeReference'] : ['type'];
      rows.push({ family, trial, httpStatus: response.status, elapsedMs: Math.round(performance.now() - started),
        validVariant: Boolean(op && op.type === family && keys.length === expected.length && expected.every(key => keys.includes(key))),
        operation: op ?? null, raw: text.slice(0, 1000), metrics: { evalCount: data.eval_count, evalDuration: data.eval_duration, loadDuration: data.load_duration },
      });
    } catch (error) { rows.push({ family, trial, validVariant: false, error: String(error), elapsedMs: Math.round(performance.now() - started) }); }
  }
}
await writeFile(new URL('./post-corrective-deep-diagnosis-schema-variant.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Narrow experimental schema only; not the production GraphMutationDraft contract.', rows }, null, 2) + '\n');
process.stdout.write(JSON.stringify(rows.map(({ family, trial, validVariant, elapsedMs, error }) => ({ family, trial, validVariant, elapsedMs, error }))) + '\n');
