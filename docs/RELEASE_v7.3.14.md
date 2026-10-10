# Hypergraph Converter Studio v7.3.14

## Release scope

v7.3.14 is the Stage 9 packaging, versioning, and clean-extraction release built from the independently approved Stage 8 checkpoint. It preserves the approved Stage 0–8 application behavior and makes no production architecture changes.

## Portable-source contract

Current CANDY policy is the additive [Scope 6A release contract](CANDY_SCOPE6A_RELEASE_CONTRACT.md).
The portable source archive is **browser-only**: native build outputs and local
qualification state are excluded; extracted CUDA must fail closed. The Stage 9
description is historical and does not qualify later CANDY native deployment.

RC2 corrects the source-package exclusion policy: repository-root `artifacts/`
evidence stays excluded, while nested production Runtime source under
`candy-runtime/src/artifacts/` is included. The optional extracted Runtime can
start with `npm run candy:runtime`, serve health and expose authenticated
discovery. CUDA_STATIC and CUDA_INCREMENTAL remain unavailable without the exact
trusted qualification context. RC1 remains NON-PASS; additive RC2 evidence binds
the corrective snapshot, and remote CPU CI must pass on the future exact RC2
commit before release closure. Public CPU CI does not establish GPU qualification.

Current Studio supports Hypergraph and DynamicHypergraph, qualified STATIC
current-count analysis and validated pending-update INCREMENTAL delta-only
analysis. Analyze and Apply are separate; analysis results grant no Apply
authority. There is no CPU or STATIC fallback for incremental analysis, implicit
projection, or large native-scale qualification claim.

The authoritative release producer is `scripts/package-portable-source.py`. It creates one project-rooted ZIP with normalized POSIX member paths, deterministic timestamps and ordering, explicit Unix metadata, and a narrow executable allowlist. It excludes dependencies, builds, Git data, coverage, transient validation evidence, review handoffs, uploads, caches, and other non-source material.

Shell, PowerShell, and Windows batch launchers are assigned mode `0755` in the ZIP. Ordinary files, including Python utilities invoked through a Python interpreter, are assigned mode `0644`. No archive entry may be group- or world-writable.

## Qualification

The actual release ZIP is inspected for path safety, collisions, duplicate members, forbidden content, CRC integrity, Unix modes, and launcher text integrity. It is then extracted outside the repository and qualified with a lockfile-defined `npm ci`, the full Node suite, lint, standard and GitHub builds, audits, Stage 0–8 preservation gates, and a real Chrome product smoke.

Final archive filename, byte size, SHA-256, member manifest, clean-extraction results, browser evidence, and the R08 decision are recorded in the external `artifacts/v7.3.14-stage9-*` release evidence. Those generated artifacts are deliberately excluded from the portable source package.

## Dependency advisory decision

Production dependencies have zero known vulnerabilities. The existing high-severity `browserslist` finding is development-only and arrives through the lint/Babel toolchain. Its remediation requires refreshing browser-data dependencies that can affect build output, so Stage 9 does not hide that change inside a release-engineering pass.
