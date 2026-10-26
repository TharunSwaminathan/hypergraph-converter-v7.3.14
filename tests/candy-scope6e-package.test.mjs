import { execFileSync } from "node:child_process";

// Synthetic local-install state only; never inspect a developer's native install.
const program = String.raw`
import importlib.util, pathlib, shutil, stat, subprocess, sys, tempfile, zipfile
root = pathlib.Path.cwd()
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
pack = load(root / "scripts/package-portable-source.py", "scope6e_pack")
verify = load(root / "scripts/verify-portable-archive.py", "scope6e_verify")
prefix = "hypergraph-motif-cuda-incremental-scope6d-tranche1-"
marker = b"SYNTHETIC_LOCAL_INSTALL_NOT_A_CREDENTIAL"
def put(base, rel, data=b"synthetic production source\n"):
    path = base / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
def inject(source, target, name, mode=stat.S_IFREG | 0o644):
    shutil.copyfile(source, target)
    with zipfile.ZipFile(target, "a") as zf:
        info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
        # ZipInfo.__init__ normalizes host separators on Windows. Set the raw
        # member afterward so malformed-name cases exercise the actual verifier.
        info.filename = name
        info.create_system = 3
        info.external_attr = mode << 16
        zf.writestr(info, marker)
    return verify.verify(target, "product")[0]

with tempfile.TemporaryDirectory(prefix="candy-scope6e-package-test-") as temp:
    work = pathlib.Path(temp)
    clean = work / "clean" / "product"
    # Only explicitly required committed inputs; fixtures below are synthetic.
    for rel in pack.REQUIRED_FILES:
        put(clean, rel, (root / rel).read_bytes())
    required = ["candy-runtime/src/artifacts/artifactStore.js"]
    for directory in ["hypergraph-motif-cuda", "hypergraph-motif-cuda-incremental"]:
        required += ["candy-runtime/native/" + directory + "/Makefile",
                     "candy-runtime/native/" + directory + "/src/main.cu"]
    required += [
        "src/fixtures/candy-runtime/native/" + prefix + "fixture/src/main.cu",
        "candy-runtime/native/near-" + prefix + "fixture/src/main.cu",
        "candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche10-fixture/src/main.cu",
        "src/fixtures/artifacts/contract.js",
    ]
    for rel in required:
        if not (clean / rel).exists():
            put(clean, rel)
        assert not pack.is_excluded(clean / rel, clean), rel
    populated = work / "populated" / "product"
    shutil.copytree(clean, populated)
    local = []
    # Empty, historical, unrelated SHA and human-readable qualifiers; case variants.
    for qualifier in ["", "f3fa7dc3", "0123456789abcdef", "future-install_2"]:
        base = "candy-runtime/native/" + prefix + qualifier
        local += [base + "/Makefile", base + "/src/main.cu",
                  base + "/build/native-binary", base + "/qualification.json",
                  base + "/bin/native-without-extension"]
    local += ["CANDY-RUNTIME/NATIVE/" + prefix.upper() + "CASE/src/main.cu"]
    excluded = local + [
        "artifacts/qualification.json", "artifacts/diagnostic-worktree/src/tool.js",
        "candy-runtime/.local/cuda_incremental-qualified-build.json",
        "candy-runtime/native/hypergraph-motif-cuda/build/native-binary",
        "candy-runtime/native/hypergraph-motif-cuda-incremental/build/native-binary",
        "native.exe", "native.dll", "native.so", ".env.local", "pairing-token.txt",
        "credentials.json", "session-secret.json", ".secrets/session.json",
        "node_modules/private.js", "dist/private.js", "coverage/report.json",
        ".git/private", ".cache/private", ".vite/private", "scratch.tmp",
    ]
    for rel in excluded:
        put(populated, rel, marker)
        assert pack.is_excluded(populated / rel, populated), rel
    archives = []
    for name, candidate in [("clean", clean), ("populated", populated)]:
        archive = work / (name + ".zip")
        pack.create_zip(candidate, archive, source_mode="snapshot")
        report, _ = verify.verify(archive, "product")
        assert report["ok"] and report["testzip"] == "ok", report
        with zipfile.ZipFile(archive) as zf:
            names = set(zf.namelist())
            assert all("product/" + rel in names for rel in required)
            assert all("product/" + rel not in names for rel in excluded)
            assert all(marker not in zf.read(i) for i in zf.infolist() if not i.is_dir())
        archives.append(archive)
    assert archives[0].read_bytes() == archives[1].read_bytes()

    # Bypass the producer entirely. Otherwise-valid entries must fail solely
    # because of the verifier's independent local-install namespace boundary.
    for index, rel in enumerate(local):
        report = inject(archives[0], work / ("injected-%d.zip" % index), "product/" + rel)
        assert not report["ok"] and "product/" + rel in report["issues"]["forbiddenMembers"], report
    directory = "product/candy-runtime/native/" + prefix + "directory-only/"
    report = inject(archives[0], work / "directory.zip", directory, stat.S_IFDIR | 0o755)
    assert not report["ok"] and directory in report["issues"]["forbiddenMembers"]
    sole = "product/candy-runtime/native/" + prefix + "unseen/Makefile"
    report = inject(archives[0], work / "sole.zip", sole)
    assert report["issues"]["forbiddenMembers"] == [sole]
    assert report["issueCount"] == 1, report

    # Check raw components before any POSIX or Windows normalization can hide
    # an alias. Exercise the API and real CLI independently of the producer.
    aliases = [
        sole.replace("candy-runtime/", "candy-runtime./"),
        sole.replace("candy-runtime/", "candy-runtime /"),
        sole.replace("native/", "native./"),
        sole.replace("native/", "native /"),
        sole.replace("native/", "native. ./"),
        sole.replace("native/", ".../native/"),
        sole.replace("native/", " /native/"),
        sole.replace("native/", "./native/"),
        sole.replace("native/", "/native/"),
        sole.replace("product/", "product./"),
        sole.replace("candy-runtime/", "CANDY-RUNTIME. /").replace("native/", "NATIVE/"),
        "product/candy-runtime./native/" + prefix + "directory-only/",
        "product/artifacts./qualification.json",
        "product/.env.", "product/native.exe ",
        "product/src/ordinary\x00hidden", "product/src/ordinary:name",
    ]
    for index, name in enumerate(aliases):
        target = work / ("alias-%d.zip" % index)
        mode = stat.S_IFDIR | 0o755 if name.endswith("/") else stat.S_IFREG | 0o644
        report = inject(archives[0], target, name, mode)
        assert not report["ok"] and name in report["issues"]["nonCanonicalMembers"], report
        cli = subprocess.run([sys.executable, str(root / "scripts/verify-portable-archive.py"),
                              str(target), "--expected-root", "product"], capture_output=True, text=True)
        assert cli.returncode == 1, (name, cli.stdout, cli.stderr)
        # Production-style guard must stop before any extraction. Then, only
        # in a separate disposable proof directory, demonstrate Windows' alias
        # behavior with our known synthetic bytes and no execution.
        if sys.platform == "win32" and index < 7:
            guarded = work / ("guarded-%d" % index)
            if report["ok"]:
                with zipfile.ZipFile(target) as zf:
                    zf.extractall(guarded)
            assert not guarded.exists()
            extraction = pathlib.Path("\\\\?\\" + str(work / ("extraction-%d" % index)))
            with zipfile.ZipFile(target) as zf:
                member = next(i for i in zf.infolist() if i.orig_filename == name)
                extracted = pathlib.Path(zf.extract(member, extraction))
            assert extracted.relative_to(extraction).as_posix() == sole
            assert extracted.read_bytes() == marker

    for index, name in enumerate([sole.replace("native/", "native.\\"),
                                  sole.replace("native/", "native \\"),
                                  sole.replace("/", "\\"), sole.replace("native/", "native\\\\")]):
        report = inject(archives[0], work / ("mixed-alias-%d.zip" % index), name)
        assert not report["ok"] and name in report["issues"]["backslashMembers"], report

    # Canonical production paths and nested names are source, not aliases.
    for index, name in enumerate([
        "product/candy-runtime/native/hypergraph-motif-cuda/src/alias-control.cu",
        "product/candy-runtime/native/hypergraph-motif-cuda-incremental/src/alias-control.cu",
        "product/src/fixtures/candy-runtime/native/" + prefix + "allowed/src/main.cu",
        "product/candy-runtime.fixture/native/" + prefix + "allowed/src/main.cu",
        "product/candy-runtime/native.fixture/" + prefix + "allowed/src/main.cu",
    ]):
        target = work / ("canonical-control-%d.zip" % index)
        report = inject(archives[0], target, name)
        assert report["ok"], report
        cli = subprocess.run([sys.executable, str(root / "scripts/verify-portable-archive.py"),
                              str(target), "--expected-root", "product"], capture_output=True, text=True)
        assert cli.returncode == 0, (name, cli.stdout, cli.stderr)

    # POSIX can hold these names during a normal producer walk. Refuse them
    # before creating/replacing an output archive; do not silently rename them.
    if sys.platform != "win32":
        for index, rel in enumerate(["candy-runtime./native/" + prefix + "alias/src/main.cu",
                                      "candy-runtime/native /" + prefix + "alias/src/main.cu"]):
            unsafe = work / ("unsafe-source-%d" % index) / "product"
            shutil.copytree(clean, unsafe)
            put(unsafe, rel, marker)
            output = work / ("unsafe-producer-%d.zip" % index)
            output.write_bytes(b"KEEP_EXISTING_OUTPUT")
            try:
                pack.create_zip(unsafe, output, source_mode="snapshot")
                raise AssertionError("Producer accepted Windows-aliased source: " + rel)
            except RuntimeError as error:
                assert "Non-portable archive path" in str(error), error
            assert output.read_bytes() == b"KEEP_EXISTING_OUTPUT"

    # Preserve orthogonal archive boundaries, even with malformed spellings.
    cases = [
        (sole.replace("/", "\\"), "backslashMembers", stat.S_IFREG | 0o644),
        (sole.replace("native/", "native\\"), "backslashMembers", stat.S_IFREG | 0o644),
        ("product/../escaped.txt", "traversalMembers", stat.S_IFREG | 0o644),
        ("/absolute.txt", "absoluteMembers", stat.S_IFREG | 0o644),
        ("C:/absolute.txt", "absoluteMembers", stat.S_IFREG | 0o644),
        ("product/link", "symlinkMembers", stat.S_IFLNK | 0o777),
        ("product/special", "specialMembers", stat.S_IFIFO | 0o644),
        ("product/writeable", "worldOrGroupWritable", stat.S_IFREG | 0o666),
        ("product/executable", "unexpectedExecutableFiles", stat.S_IFREG | 0o755),
        ("product/ordinary", "incorrectOrdinaryModes", stat.S_IFREG | 0o600),
        ("product/launch.sh", "missingExecutableBits", stat.S_IFREG | 0o644),
        ("product/bad-dir/", "incorrectDirectoryModes", stat.S_IFDIR | 0o700),
        ("another-root/file", "rootLayout", stat.S_IFREG | 0o644),
        ("product/README.md", "duplicateMembers", stat.S_IFREG | 0o644),
        ("product/readme.md", "caseCollisions", stat.S_IFREG | 0o644),
    ]
    for index, (name, issue, mode) in enumerate(cases):
        report = inject(archives[0], work / ("unsafe-%d.zip" % index), name, mode)
        assert not report["ok"] and report["issues"][issue], (name, issue, report)
    non_unix = work / "non-unix.zip"
    with zipfile.ZipFile(non_unix, "w") as zf:
        info = zipfile.ZipInfo("product/file")
        info.create_system = 0
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        zf.writestr(info, marker)
    assert verify.verify(non_unix, "product")[0]["issues"]["nonUnixCreateSystem"]
    corrupt = work / "corrupt.zip"
    with zipfile.ZipFile(corrupt, "w", compression=zipfile.ZIP_STORED) as zf:
        info = zipfile.ZipInfo("product/file")
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        zf.writestr(info, marker)
    data = corrupt.read_bytes()
    assert data.count(marker) == 1
    corrupt.write_bytes(data.replace(marker, b"X" + marker[1:]))
    assert verify.verify(corrupt, "product")[0]["issues"]["crcFailures"]
    # Every old excluded-state category must also fail independent injection.
    for index, rel in enumerate(excluded[len(local):]):
        report = inject(archives[0], work / ("old-policy-%d.zip" % index), "product/" + rel)
        assert not report["ok"] and report["issues"]["forbiddenMembers"], (rel, report)
print("Scope 6E synthetic clean/populated byte identity, native inclusion, local-install exclusion and independent malformed-archive rejection passed.")
`;

execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  ["-c", program], {
    cwd: process.cwd(), windowsHide: true, timeout: 60000, stdio: "inherit",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
