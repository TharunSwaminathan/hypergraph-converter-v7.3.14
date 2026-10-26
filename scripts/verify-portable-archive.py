#!/usr/bin/env python3
"""Verify the actual portable release archive and emit its member manifest."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath


EXECUTABLE_SUFFIXES = {".sh", ".bat", ".ps1", ".command"}
FORBIDDEN_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
    "__MACOSX",
    "upload",
    "uploads",
    "__pycache__",
    "build", ".local", ".codex", ".secrets", "tmp", "temp",
    ".cache", ".pytest_cache", ".vite",
}
FORBIDDEN_NAMES = {".DS_Store", "Thumbs.db", ".env"}
FORBIDDEN_SUFFIXES = {
    ".gguf",
    ".safetensors",
    ".onnx",
    ".pt",
    ".pth",
    ".ckpt",
    ".pem",
    ".key",
    ".zip", ".exe", ".dll", ".so", ".log", ".tmp", ".temp",
}


def unix_mode(info: zipfile.ZipInfo) -> int:
    return (info.external_attr >> 16) & 0o7777


def file_type(info: zipfile.ZipInfo) -> int:
    return (info.external_attr >> 16) & 0o170000


def write_json(path: Path | None, value: object) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8", newline="\n")


def forbidden_source(parts: tuple[str, ...]) -> bool:
    """Independent release membership exclusions; never import producer policy."""
    if not parts:
        return True
    base = parts[-1].lower()
    return (
        parts[0].casefold() == "artifacts"
        or (len(parts) >= 3 and tuple(p.casefold() for p in parts[:2]) == ("candy-runtime", "native")
            and parts[2].casefold().startswith("hypergraph-motif-cuda-incremental-scope6d-tranche1-"))
        or any(p.casefold() in {v.casefold() for v in FORBIDDEN_PARTS} for p in parts)
        or base in {v.casefold() for v in FORBIDDEN_NAMES}
        or base.startswith((".env.", "id_rsa")) or PurePosixPath(base).suffix in FORBIDDEN_SUFFIXES
        or base.endswith("-independent-review-handoff.txt") or re.fullmatch(r"stage.*-review\.txt", base) is not None
        or any(fnmatch.fnmatch(base, p) for p in ["*token*.txt", "*token*.json", "*credential*.json", "*secret*.json", "core", "core.*"])
    )


def committed_inventory(root: Path, revision: str) -> tuple[str, dict[str, str]]:
    """Derive expected content from trusted Git separately from the producer."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_OPTIONAL_LOCKS="0", GIT_NO_REPLACE_OBJECTS="1")
    def git(*args: str, data: bytes | None = None) -> bytes:
        try:
            return subprocess.run(["git", "-C", str(root), *args], input=data,
                                  env=env, capture_output=True, check=True).stdout
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("Independent commit-bound verification requires usable Git metadata.") from error
    if Path(git("rev-parse", "--show-toplevel").decode().strip()).resolve() != root.resolve():
        raise RuntimeError("Verification source must be the Git worktree root.")
    commit = git("rev-parse", "--verify", "--end-of-options", revision + "^{commit}").decode().strip()
    rows = []
    seen = set()
    for row in git("ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not row:
            continue
        header, raw = row.split(b"\t", 1)
        mode, kind, oid = header.decode("ascii").split()
        name = raw.decode("utf-8")
        if "\\" in name or any(not p or p in {".", ".."} or p.endswith((".", " "))
            or any(ord(c) < 32 or c in ':<>|"?*' for c in p) for p in name.split("/")):
            raise RuntimeError(f"Unsafe committed inventory path: {name}")
        if forbidden_source(tuple(name.split("/"))):
            continue
        if name.casefold() in seen:
            raise RuntimeError(f"Case-colliding committed inventory path: {name}")
        seen.add(name.casefold())
        if mode not in {"100644", "100755"} or kind != "blob":
            raise RuntimeError(f"Non-regular committed inventory entry: {name}")
        rows.append((name, oid))
    stream = git("cat-file", "--batch", data="".join(oid + "\n" for _, oid in rows).encode("ascii"))
    expected = {}
    offset = 0
    for name, oid in rows:
        end = stream.index(b"\n", offset)
        actual_oid, kind, count = stream[offset:end].decode("ascii").split()
        count = int(count)
        blob = stream[end + 1:end + count + 1]
        digest = hashlib.sha1 if len(oid) == 40 else hashlib.sha256
        if actual_oid != oid or kind != "blob" or len(blob) != count or digest(b"blob " + str(count).encode() + b"\0" + blob).hexdigest() != oid:
            raise RuntimeError(f"Invalid committed blob identity: {name}")
        expected[name] = hashlib.sha256(blob).hexdigest()
        offset = end + count + 2
    if offset != len(stream):
        raise RuntimeError("Unexpected committed inventory stream data.")
    return commit, expected


def verify(archive: Path, expected_root: str | None, *, source_root: Path | None = None,
           revision: str = "HEAD") -> tuple[dict[str, object], dict[str, object]]:
    archive_bytes = archive.read_bytes()
    issues: dict[str, list[object]] = {
        "backslashMembers": [],
        "nonCanonicalMembers": [],
        "absoluteMembers": [],
        "traversalMembers": [],
        "duplicateMembers": [],
        "caseCollisions": [],
        "forbiddenMembers": [],
        "symlinkMembers": [],
        "specialMembers": [],
        "unexpectedExecutableFiles": [],
        "missingExecutableBits": [],
        "incorrectOrdinaryModes": [],
        "incorrectDirectoryModes": [],
        "worldOrGroupWritable": [],
        "nonUnixCreateSystem": [],
        "rootLayout": [],
        "crcFailures": [],
        "sourceInventory": [],
    }

    with zipfile.ZipFile(archive, "r") as zf:
        infos = zf.infolist()
        # ZipInfo normalizes host separators in filename on Windows; retain
        # the original member spelling so backslashes cannot bypass rejection.
        names = [info.orig_filename for info in infos]
        name_counts = Counter(names)
        issues["duplicateMembers"] = sorted(name for name, count in name_counts.items() if count > 1)

        first_by_casefold: dict[str, str] = {}
        for name in names:
            folded = name.casefold()
            previous = first_by_casefold.setdefault(folded, name)
            if previous != name:
                issues["caseCollisions"].append([previous, name])

        roots: set[str] = set()
        manifest_members = []
        mode_counts: Counter[str] = Counter()
        for info in infos:
            name = info.orig_filename
            # Validate the raw spelling before PurePosixPath collapses empty
            # or dot components, or Windows extraction strips dots/spaces.
            # Reject aliases explicitly; never normalize them into acceptance.
            raw_parts = (name[:-1] if name.endswith("/") else name).split("/")
            if any(
                not part or part in {".", ".."} or part.endswith((".", " "))
                or any(ord(char) < 32 or char in ':<>|"?*' for char in part)
                for part in raw_parts
            ):
                issues["nonCanonicalMembers"].append(name)
            normalized = name.rstrip("/")
            pure = PurePosixPath(normalized)
            parts = pure.parts
            if parts:
                roots.add(parts[0])

            mode = unix_mode(info)
            mode_text = f"{mode:04o}"
            mode_counts[mode_text] += 1
            suffix = PurePosixPath(normalized).suffix.lower()
            type_bits = file_type(info)

            if "\\" in name:
                issues["backslashMembers"].append(name)
            if pure.is_absolute() or re.match(r"^[A-Za-z]:", normalized):
                issues["absoluteMembers"].append(name)
            if ".." in parts:
                issues["traversalMembers"].append(name)
            if len(parts) > 1 and forbidden_source(parts[1:]):
                issues["forbiddenMembers"].append(name)
            if stat.S_ISLNK(type_bits):
                issues["symlinkMembers"].append(name)
            if type_bits not in {stat.S_IFREG, stat.S_IFDIR}:
                issues["specialMembers"].append([name, oct(type_bits)])
            if info.create_system != 3:
                issues["nonUnixCreateSystem"].append([name, info.create_system])
            if mode & 0o022:
                issues["worldOrGroupWritable"].append([name, mode_text])

            if info.is_dir():
                if mode != 0o755:
                    issues["incorrectDirectoryModes"].append([name, mode_text])
            elif suffix in EXECUTABLE_SUFFIXES:
                if mode != 0o755:
                    issues["missingExecutableBits"].append([name, mode_text])
            elif mode & 0o111:
                issues["unexpectedExecutableFiles"].append([name, mode_text])
            elif mode != 0o644:
                issues["incorrectOrdinaryModes"].append([name, mode_text])

            manifest_members.append({
                "path": name,
                "uncompressedSize": info.file_size,
                "compressedSize": info.compress_size,
                "createSystem": info.create_system,
                "unixMode": mode_text,
                "crc": f"{info.CRC:08x}",
            })

        if expected_root is not None and roots != {expected_root}:
            issues["rootLayout"].append({"expected": [expected_root], "actual": sorted(roots)})
        elif len(roots) != 1:
            issues["rootLayout"].append({"expectedCount": 1, "actual": sorted(roots)})

        bad_crc_member = zf.testzip()
        if bad_crc_member is not None:
            issues["crcFailures"].append(bad_crc_member)

        source_commit = None
        if source_root is not None:
            source_commit, expected = committed_inventory(source_root, revision)
            root_name = expected_root or (next(iter(roots)) if len(roots) == 1 else "")
            expected_files = {root_name + "/" + p: digest for p, digest in expected.items()}
            actual_files = {i.orig_filename: hashlib.sha256(zf.read(i)).hexdigest() for i in infos if not i.is_dir()}
            for name in sorted(expected_files.keys() | actual_files.keys()):
                if expected_files.get(name) != actual_files.get(name):
                    issues["sourceInventory"].append(name)
            expected_dirs = {root_name + "/"}
            for name in expected_files:
                components = name.split("/")[:-1]
                expected_dirs.update("/".join(components[:i]) + "/" for i in range(1, len(components) + 1))
            for name in sorted({i.orig_filename for i in infos if i.is_dir()} ^ expected_dirs):
                issues["sourceInventory"].append(name)

    unique_forbidden = sorted(set(issues["forbiddenMembers"]))
    issues["forbiddenMembers"] = unique_forbidden
    issue_count = sum(len(value) for value in issues.values())
    root = sorted(roots)[0] if len(roots) == 1 else None
    report = {
        "archive": archive.name,
        "bytes": len(archive_bytes),
        "sha256": hashlib.sha256(archive_bytes).hexdigest(),
        "memberCount": len(manifest_members),
        "root": root,
        "testzip": "ok" if not issues["crcFailures"] else "failed",
        "modeCounts": dict(sorted(mode_counts.items())),
        "issues": issues,
        "issueCount": issue_count,
        "ok": issue_count == 0,
        "verificationLevel": "commit-bound" if source_root is not None else "structural-only",
        "sourceCommit": source_commit,
    }
    manifest = {
        "archive": archive.name,
        "sha256": report["sha256"],
        "memberCount": len(manifest_members),
        "root": root,
        "members": manifest_members,
    }
    return report, manifest


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Verify a Hypergraph Converter portable source ZIP.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--expected-root")
    parser.add_argument("--source-root", type=Path, help="Trusted Git source root for independent commit-bound membership and byte verification.")
    parser.add_argument("--revision", default="HEAD", help="Trusted committed revision for --source-root.")
    parser.add_argument("--report-output", type=Path)
    parser.add_argument("--manifest-output", type=Path)
    args = parser.parse_args(argv)

    archive = args.archive.resolve()
    report, manifest = verify(archive, args.expected_root, source_root=args.source_root, revision=args.revision)
    write_json(args.report_output, report)
    write_json(args.manifest_output, manifest)
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
