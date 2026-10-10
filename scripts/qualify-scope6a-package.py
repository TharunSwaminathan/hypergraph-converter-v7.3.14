"""CPU-only clean/populated package qualification. No Runtime/GPU startup."""
import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import time
import zipfile
from pathlib import Path

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def qualify(root, node):
    pack = load(root / "scripts/package-portable-source.py", "source_pack")
    verify = load(root / "scripts/verify-portable-archive.py", "source_verify")
    workspace = Path(tempfile.mkdtemp(prefix="candy-scope6a-package-"))
    clean = workspace / "clean" / root.name
    for source in pack.iter_source_files(root):
        if source.is_symlink():
            raise RuntimeError("Symlink source rejected")
        target = clean / source.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    populated = workspace / "populated" / root.name
    shutil.copytree(clean, populated)
    private_marker = "SCOPE6A_SYNTHETIC_" + "PRIVATE_MARKER"
    excluded = ["candy-runtime/.local/cuda_static-qualified-build.json", "candy-runtime/native/hypergraph-motif-cuda/build/private-binary",
                "candy-runtime/native/hypergraph-motif-cuda-incremental/build/private-binary", ".env.local", "pairing-token.txt",
                "credentials.json", ".secrets/session.json", "tmp/upload.json", "artifacts/private-graph.json", "BUILD/private.exe", "scratch.tmp"]
    for rel in excluded:
        target = populated / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(private_marker, encoding="utf-8")
    cases=[]
    hashes=[]
    for name, candidate in [("actual",root),("clean",clean),("populated",populated)]:
        archive=workspace / (name+".zip")
        started=time.perf_counter()
        counts=pack.create_zip(candidate, archive)
        milliseconds=(time.perf_counter()-started)*1000
        report, manifest=verify.verify(archive, root.name)
        if not report["ok"]:
            raise RuntimeError(json.dumps(report))
        content=archive.read_bytes()
        sha=hashlib.sha256(content).hexdigest()
        hashes.append(sha)
        with zipfile.ZipFile(archive) as zf:
            assert all(private_marker.encode() not in zf.read(info) for info in zf.infolist() if not info.is_dir())
            for module in ["hypergraph-motif-cuda-contract.mjs","hypergraph-motif-cuda-incremental-contract.mjs"]:
                assert f"{root.name}/candy-runtime/test/{module}" in zf.namelist()
        cases.append({"case":name,"status":"PASS","sha256":sha,"bytes":len(content),"counts":counts,"generationMs":milliseconds,"integrity":report})
    assert len(set(hashes)) == 1, "Identical source bytes must produce identical archives"
    extraction=workspace / "extracted"
    with zipfile.ZipFile(workspace / "clean.zip") as zf:
        zf.extractall(extraction)
    extracted=extraction / root.name
    assert not (extracted / ".git").exists() and not (extracted / "artifacts").exists()
    program="import {verifyQualifiedMotifBackend} from './candy-runtime/src/capabilities/motifQualification.js'; for(const backend of ['CUDA_STATIC','CUDA_INCREMENTAL']) {const result=await verifyQualifiedMotifBackend({runtimeRoot:new URL('./candy-runtime/',import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/,'$1')},backend);if(result.available)throw Error('Unexpected qualified CUDA');console.log(JSON.stringify({backend,...result}));}"
    # A file URL rooted in cwd is portable on Windows and Linux.
    program="import {fileURLToPath} from 'node:url';"+program.replace("new URL('./candy-runtime/',import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/,'$1')", "fileURLToPath(new URL('./candy-runtime/',import.meta.url))")
    result=subprocess.run([node,"--input-type=module","-e",program],cwd=extracted,capture_output=True,text=True,timeout=15,check=True)
    unavailable=[json.loads(line) for line in result.stdout.splitlines()]
    return {"schemaVersion":"candy.scope6a-package-qualification/1","status":"PASS","distribution":"BROWSER_ONLY_SOURCE",
            "cases":cases,"identicalBytes":True,"syntheticExcludedPaths":excluded,"extractedRoot":str(extracted),
            "noGitOrEvidence":True,"cuda":unavailable,"browserBuild":"NOT_YET_RUN","descriptiveOnly":True,"publisherAttestation":False}

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--node",default="node")
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=qualify(args.root.resolve(),args.node)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(json.dumps({"status":result["status"],"identicalBytes":True,"extractedRoot":result["extractedRoot"]}))
