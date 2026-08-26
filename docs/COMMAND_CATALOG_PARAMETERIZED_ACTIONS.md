# Command Catalog Parameterized Actions

v7.3.10 parses parameter slots deterministically and executes them through existing application actions.

| Pattern | Intent | Slot | Runtime behavior |
| --- | --- | --- | --- |
| `Activate batch <number>` | `activate_batch_number` | `batchNumber` | Resolves an existing batch, activates it, and verifies activation. |
| `Switch to batch <number>` | `activate_batch_number` | `batchNumber` | Activation alias. |
| `Select batch <number>` | `activate_batch_number` | `batchNumber` | Activation alias. |
| `Generate parser for batch <number>` | `generate_parser_for_batch` | `batchNumber` | Validates the target batch/mapping, activates it, then directly dispatches the existing parser-generation plan. |
| `Create parser for batch <number>` | `generate_parser_for_batch` | `batchNumber` | Parser-generation alias. |
| `Use model <model name>` | `local_model_select` | `modelName` | Updates the configured local Ollama model name through existing settings state. It does not download or contact a model by itself. |

Missing slots are safe clarification, never `Batch undefined`:

```text
Activate batch                 -> ask for batch number
Generate parser for batch      -> ask for batch number
Use model                      -> ask for model name
```

Context requirements are enforced before execution:

- numbered activation requires `existing_batch`;
- numbered parser generation requires `existing_batch` and `valid_mapping_for_batch`;
- model names must pass local settings validation.

Instructional wrappers remain Help only:

```text
How do I activate batch 2?
What command generates a parser for batch 2?
Could you tell me what to type to use model qwen3:8b?
```
