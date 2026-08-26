# v7.3.6 test report

This release adds focused regression coverage for:

- graph identifier normalization and quoted-literal preservation;
- V2V projection weight policy and canonical export projection metadata;
- incidence density vs V2V projection density;
- singleton hyperedge validation labels;
- Dijkstra zero, missing, negative, and invalid weight behavior;
- batch Preview / Commit / Discard UI affordances and graph-edit guard.

Run:

```bash
npm run test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
```

The final packaging pass should exclude `node_modules`, `dist`, generated artifacts, `__MACOSX`, and `.DS_Store`.
