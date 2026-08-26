# Dataset Grouping

`src/agent/datasetGrouping.js` separates one upload batch into logical groups:

- `static_graph`
- `validation_only`
- `update_stream`
- `ignored`
- `unknown`

Grouping uses deterministic role guesses, filenames, relationship evidence, and parse mode. Ambiguous multi-file uploads remain in `needs_clarification` until the user chooses together/separate/grouped behavior.
