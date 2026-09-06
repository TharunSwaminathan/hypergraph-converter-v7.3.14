const ids = [
  "paperA",
  "group-7",
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
  "0",
  "17",
];

const whitespace = [" ", "  ", "\t"];

export function buildCorrectiveAFormatCorpus() {
  const cases = [];
  let sequence = 0;
  const add = (family, expectedFormat, text, options = {}) => {
    sequence += 1;
    cases.push({
      id: `PQA-${String(sequence).padStart(3, "0")}`,
      family,
      expectedFormat,
      text,
      ambiguous: false,
      ...options,
    });
  };

  for (const [idIndex, id] of ids.entries()) {
    for (let variant = 0; variant < 5; variant += 1) {
      const ws = whitespace[variant % whitespace.length];
      const metadata = variant % 2 === 0 ? `[t=${idIndex + variant}]` : `[weight=${variant - 1}]`;
      const trailing = variant % 3 === 0 ? ` @weight=${variant}` : "";
      add(
        "h2v_metadata",
        "simple",
        `${id}${ws}${metadata}:${ws}v${variant},${ws}v${variant + 1}${trailing}\n${id}-next [label=batch${variant}]: v${variant + 1} v${variant + 2}`,
      );
    }
  }

  for (let variant = 0; variant < 15; variant += 1) {
    const prefix = ["h", "he", "edge", "hyperedge"][variant % 4];
    add("h2v_named", "simple", `${prefix}${variant}: a${variant}, b${variant}\n${prefix}${variant + 20}: b${variant} c${variant}`);
  }

  for (let variant = 0; variant < 20; variant += 1) {
    const suffix = variant ? String(variant) : "";
    const separator = variant % 2 ? ", " : " ";
    add(
      "adjacency",
      "adjlist",
      `A${suffix}: B${suffix}${separator}C${suffix}\nB${suffix}: A${suffix}${separator}C${suffix}\nC${suffix}: A${suffix}${separator}B${suffix}`,
    );
  }

  for (let variant = 0; variant < 20; variant += 1) {
    const text = variant % 2 === 0
      ? `"paper:${variant}","Alice, ${variant}"\n"paper:${variant + 1}",Bob`
      : `paper${variant},Alice,Bob\npaper${variant + 1},Bob,Carol`;
    add("csv", "csv", text);
  }

  for (let variant = 0; variant < 10; variant += 1) {
    add("h2h", "h2h", `h${variant}: h${variant + 1}[shared: v${variant}]\nh${variant + 1}: (none)`);
  }

  for (let variant = 0; variant < 10; variant += 1) {
    add("whitespace", "csv", `a${variant} b${variant} c${variant}\nb${variant} c${variant}`);
  }

  for (const id of ids) {
    add("ambiguous_colon", null, `${id}: memberA memberB`, {
      ambiguous: true,
      expectedCandidates: ["simple", "adjlist"],
    });
    add("ambiguous_colon_comma", null, `${id}:memberA,memberB`, {
      ambiguous: true,
      expectedCandidates: ["simple", "adjlist"],
    });
  }

  return Object.freeze(cases.map(item => Object.freeze(item)));
}
