#!/usr/bin/env python3
"""Verify the actual portable release archive and emit its member manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath


EXECUTABLE_SUFFIXES = {".sh", ".bat", ".ps1"}
FORBIDDEN_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
    "artifacts",
    "__MACOSX",
    "upload",
    "uploads",
    "__pycache__",
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


def verify(archive: Path, expected_root: str | None) -> tuple[dict[str, object], dict[str, object]]:
    archive_bytes = archive.read_bytes()
    issues: dict[str, list[object]] = {
        "backslashMembers": [],
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
    }

    with zipfile.ZipFile(archive, "r") as zf:
        infos = zf.infolist()
        names = [info.filename for info in infos]
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
            name = info.filename
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
            if any(part in FORBIDDEN_PARTS for part in parts):
                issues["forbiddenMembers"].append(name)
            basename = parts[-1] if parts else ""
            if (
                basename in FORBIDDEN_NAMES
                or basename.startswith(".env.")
                or basename.lower().startswith("id_rsa")
                or suffix in FORBIDDEN_SUFFIXES
                or basename.lower().endswith("-independent-review-handoff.txt")
                or re.fullmatch(r"stage.*-review\.txt", basename, re.IGNORECASE)
            ):
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
    parser.add_argument("--report-output", type=Path)
    parser.add_argument("--manifest-output", type=Path)
    args = parser.parse_args(argv)

    archive = args.archive.resolve()
    report, manifest = verify(archive, args.expected_root)
    write_json(args.report_output, report)
    write_json(args.manifest_output, manifest)
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
