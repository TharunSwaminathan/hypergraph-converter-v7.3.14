import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../candy-runtime/native/sssp-openmp/src/main.cpp", import.meta.url), "utf8");
const makefile = await readFile(new URL("../candy-runtime/native/sssp-openmp/Makefile", import.meta.url), "utf8");
const provenance = await readFile(new URL("../candy-runtime/native/upstream/MOSP-OpenMP-PROVENANCE.md", import.meta.url), "utf8");

assert.match(source, /argc != 3/);
assert.match(source, /std::string\(argv\[1\]\) != "--request"/);
assert.doesNotMatch(source, /\bsystem\s*\(/, "native POC must not invoke a shell");
assert.doesNotMatch(source, /popen\s*\(/, "native POC must not spawn arbitrary processes");
assert.doesNotMatch(source, /buildTwoSection|cliqueExpansion|incidenceProjection|lineGraphProjection|projectHypergraph/i, "native SSSP must not call or construct a hypergraph projection");
assert.match(source, /RESULT_VALIDATION_FAILURE/);
assert.match(source, /INVALID_GRAPH_TYPE/);
assert.match(source, /request\.graph_type != "OrdinaryGraph"/);
assert.match(source, /STALE_PROPERTY_STATE/);
assert.match(source, /#pragma omp parallel for/);
assert.match(makefile, /CXX \?= g\+\+/);
assert.doesNotMatch(makefile, /g\+\+-15/);
assert.match(provenance, /ED12A58F2B5E4C5EBE229875BE8D3502C1EAD80506B077013D6B04CB34BA6C69/);
assert.match(provenance, /no LICENSE or COPYING file/i);

console.log("CANDY Phase B native source boundary tests passed.");
