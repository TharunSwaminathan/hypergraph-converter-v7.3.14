import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

// Exercise the real producer/verifier and extracted production Runtime. No
// injected discovery, native runner, qualification record or Git context.
const program = String.raw`
import importlib.util, json, pathlib, shutil, stat, subprocess, sys, tempfile, zipfile
root = pathlib.Path.cwd()
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
pack = load(root / "scripts/package-portable-source.py", "rc2_pack")
verify = load(root / "scripts/verify-portable-archive.py", "rc2_verify")
workspace = pathlib.Path(tempfile.mkdtemp(prefix="candy-rc2-regression-"))
clean = workspace / "clean" / root.name
for source in pack.iter_source_files(root):
    assert not source.is_symlink()
    target = clean / source.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
required = "candy-runtime/src/artifacts/artifactStore.js"
assert required in pack.REQUIRED_FILES
assert (clean / required).is_file()
other_source = "src/rc2-package-fixture/artifacts/contract.mjs"
target = clean / other_source
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text("export const sourceContract = true;\n", encoding="utf-8")
populated = workspace / "populated" / root.name
shutil.copytree(clean, populated)
excluded = [
    "artifacts/qualification.json", "ARTIFACTS/evidence.json",
    "candy-runtime/.local/cuda_static-qualified-build.json",
    "candy-runtime/.local/cuda_incremental-qualified-build.json",
    "candy-runtime/native/hypergraph-motif-cuda/build/private-binary",
    "candy-runtime/native/hypergraph-motif-cuda-incremental/build/private-binary",
    ".env.local", "pairing-token.txt", "credentials.json", ".secrets/session.json",
    "src/rc2-package-fixture/artifacts/.env.local",
    "src/rc2-package-fixture/artifacts/pairing-token.json",
    "tmp/upload.json", "scratch.tmp", "node_modules/private.txt", "dist/private.txt",
]
for rel in excluded:
    target = populated / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("SYNTHETIC_NON_SECRET\n", encoding="utf-8")
for candidate in [clean, populated]:
    assert not pack.is_excluded(candidate / required, candidate)
    assert not pack.is_excluded(candidate / other_source, candidate)
    for rel in excluded:
        assert pack.is_excluded(candidate / rel, candidate), rel
archives = []
for name, candidate in [("clean", clean), ("populated", populated)]:
    archive = workspace / (name + ".zip")
    counts = pack.create_zip(candidate, archive)
    report, manifest = verify.verify(archive, root.name)
    assert report["ok"] and report["testzip"] == "ok", report
    assert counts["artifacts_entries"] == 0
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())
        assert root.name + "/" + required in names
        assert root.name + "/" + other_source in names
        assert all(root.name + "/" + rel not in names for rel in excluded)
    archives.append(archive)
assert archives[0].read_bytes() == archives[1].read_bytes()
contaminated = workspace / "contaminated.zip"
shutil.copyfile(archives[0], contaminated)
with zipfile.ZipFile(contaminated, "a") as zf:
    for rel in ["artifacts/evidence.json", "ARTIFACTS/qualification.json"]:
        info = zipfile.ZipInfo(root.name + "/" + rel)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        zf.writestr(info, b"SYNTHETIC_NON_SECRET")
report, _ = verify.verify(contaminated, root.name)
assert not report["ok"]
assert all(root.name + "/" + rel in report["issues"]["forbiddenMembers"]
           for rel in ["artifacts/evidence.json", "ARTIFACTS/qualification.json"])
extraction = workspace / "extracted"
with zipfile.ZipFile(archives[0]) as zf:
    zf.extractall(extraction)
extracted = extraction / root.name
assert all(not (extracted / rel).exists() for rel in [".git", "artifacts", "candy-runtime/.local"])
probe = workspace / "runtime-probe.mjs"
server_url = (extracted / "candy-runtime/src/server.js").as_uri()
probe.write_text('''
import {startCandyRuntime} from ''' + json.dumps(server_url) + ''';
const runtime = await startCandyRuntime({port:0});
try {
  const base = "http://127.0.0.1:" + runtime.port;
  const health = await fetch(base + "/v1/health");
  if (!health.ok || (await health.json()).runtimeStatus !== "ready") throw Error("Health failed");
  const unauthenticated = await fetch(base + "/v1/capabilities");
  if (unauthenticated.status !== 401) throw Error("Discovery auth weakened");
  const discovery = await fetch(base + "/v1/capabilities", {headers:{Authorization:"Bearer " + runtime.pairingToken}});
  if (!discovery.ok) throw Error("Discovery failed");
  const declaration = await discovery.json();
  for (const backend of ["CUDA_STATIC", "CUDA_INCREMENTAL"]) {
    const readiness = declaration.motifReadiness.find(value => value.backend === backend);
    if (readiness?.status !== "UNAVAILABLE" || readiness.reason !== "motif_qualification_unavailable_or_stale"
      || declaration.capabilities.some(value => value.backend === backend)) throw Error("CUDA did not fail closed");
  }
  console.log(JSON.stringify({startup:true,health:true,authenticatedDiscovery:true,cudaFailClosed:true}));
} finally { await runtime.close(); }
''', encoding="utf-8")
result = subprocess.run([sys.argv[1], str(probe)], capture_output=True, text=True, timeout=20, check=True)
assert json.loads(result.stdout)["cudaFailClosed"]
print("RC2 real source archive inclusion/exclusion, byte reproducibility, contaminated archive rejection, extracted Runtime startup/health/auth/discovery and CUDA fail-closed regressions passed.")
`;

execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  ["-c", program, process.execPath], {
    cwd: process.cwd(), windowsHide: true, timeout: 60000, stdio: "inherit",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });

const runtimeDocs = await readFile(new URL("../candy-runtime/README.md", import.meta.url), "utf8");
assert.doesNotMatch(runtimeDocs, /therefore enables STATIC only/);
const normalizedDocs = runtimeDocs.replace(/\s+/g, " ");
for (const term of ["Hypergraph and DynamicHypergraph", "CUDA_STATIC", "CUDA_INCREMENTAL", "delta-only",
  "Apply never derives authority", "CPU fallback", "STATIC fallback", "implicit projection",
  "Public GitHub Actions", "do not establish GPU"]) assert.ok(normalizedDocs.includes(term), term);
