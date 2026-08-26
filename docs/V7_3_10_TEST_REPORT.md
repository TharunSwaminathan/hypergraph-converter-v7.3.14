# v7.3.10 Test Report

## Scope

This report covers the v7.3.10 remediation built from the preserved v7.3.9 source package.

## Deterministic and regression suite

`npm test` executes the complete historical suite plus v7.3.10 release gates. The added gates cover:

- registry required-context and planner-handler authority;
- selection-bound confirmation staleness;
- correction safety;
- pure and live pending-state routing;
- numbered batch and model-selection execution;
- request lifecycle ownership;
- centralized confirmation policy;
- structured runtime outcome traces;
- compositional Help and explicit no-action matrices;
- trusted-code Custom Parser guard and pre-serialization output limits.

## Safety matrices

| Matrix | State-changing catalog bases | Frames | Requests | Allowed state-changing results |
| --- | ---: | ---: | ---: | ---: |
| Instructional/compositional Help | 164 | 40 | 6,560 | 0 |
| Explicit no-action/reported/hypothetical | 164 | 20 | 3,280 | 0 |

## Source parsing

- Node `--check`: all `.js` and `.mjs` files under `src`, `scripts`, and `tests`.
- TypeScript `transpileModule`: all `.js`, `.jsx`, and `.mjs` files under those directories, including JSX syntax.

## Dependency-install limitation in the verification environment

The internal npm mirror returned HTTP 404 for `zod-validation-error@4.0.2`, a transitive dependency of `eslint-plugin-react-hooks@7.1.1`. Direct access to the public npm registry was unavailable in this environment. Therefore this verification run could not reinstall dependencies and could not honestly repeat ESLint, Vite production build, GitHub Pages build, npm audit, or browser smoke.

This is an environment/package-mirror limitation, not recorded as a passing check. The source package retains the lockfile and normal commands so those checks can be repeated in an environment with npm registry access:

```bash
npm ci
npm run lint
npm test
npm run build
npm run build:github
npm audit
npm audit --omit=dev
```
