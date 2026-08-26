# Parser Profile Schema

Parser profiles save reusable deterministic mapping/parser context in browser local storage.

Storage key:

```text
hypergraph_converter_parser_profiles_v7_2
```

Profile shape:

```js
{
  id,
  name,
  createdAt,
  updatedAt,
  datasetType,
  fileRoles,
  fileSignatures,
  mappingSpec,
  parserCode,
  fingerprint
}
```

Profiles are local-only. They are not uploaded, not sent to Ollama automatically, and not synced to a backend. The user can export them as a JSON file from Custom Parser Studio.

Matching is deterministic and conservative: current file names/extensions are compared with saved profile signatures and the UI offers the best local matches.
# v7.3 parser profile schema note

Parser profiles now include `schemaVersion: 3`, header fingerprints, structural headers, file roles, and a compact relationship signature. Profile matches may use filename/extension compatibility plus structural header evidence, but profiles never auto-run or auto-apply; the user must explicitly select and revalidate them.
