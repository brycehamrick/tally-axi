---
name: tally-axi
description: Use tally-axi for Tally tasks - listing and reading forms, reading form submissions and answers, deleting submissions, and managing FORM_RESPONSE webhooks - instead of calling the Tally REST API directly or hand-building HTTP requests.
---

# tally-axi

Agent-ergonomic CLI over the public Tally REST API. TOON output, pre-computed
counts, truncation with `--full`, structured errors, and `help[]` next steps on
every result.

## When to use

- See what this key can read → `tally-axi` (no arguments shows a live home view)
- List forms → `tally-axi forms list [--limit N]`
- Read one form → `tally-axi forms get <formId>` (add `--full` for the complete definition)
- List responses → `tally-axi submissions list <formId> [--limit N]`
- Read one response → `tally-axi submissions get <formId> <submissionId>` (add `--full`)
- Delete a response → `tally-axi submissions delete <formId> <submissionId> --confirm` (irreversible)
- List webhooks → `tally-axi webhooks list <formId>`
- Subscribe an endpoint → `tally-axi webhooks create <formId> --url <https-url> --confirm`
- Remove a webhook → `tally-axi webhooks delete <webhookId> --confirm`

Form creation and editing are not in Tally's public API — direct the user to tally.so.

## Auth

Required for data commands. `TALLY_API_KEY` comes from the environment (create it in
Tally settings). Never ask the user to paste the key into chat, never put it in command
arguments, files, or examples. `tally-axi` with no arguments reports the current auth
state without needing a key.

## Invocation

Installed globally: `tally-axi <command>`. Otherwise run on demand:
`npx -y tally-axi@latest <command>`. Both are identical.

## Conventions

- Default output is compact TOON; pass `--json` for machine-readable JSON.
- Large fields (form definitions, submission answers) are truncated with size hints;
  pass `--full` for complete text.
- Empty results print explicit `0 forms` / `0 submissions` markers, never blank output.
- Exit codes: 0 success, 2 usage/validation/missing `--confirm`, 1 runtime or API
  failure. Errors carry `error`/`code`/`help[]` on stdout.
- Identifier kinds are distinct: `formId` (forms), `submissionId` (per form),
  `webhookId`. Obtain child ids from the correct parent and never guess them — list
  first when unsure.

## Safety

- `--confirm` gates every mutation; without it the CLI previews the change and makes
  zero network calls.
- Deletion is permanent. Verify the target with a read before deleting, and ask the
  user for explicit confirmation immediately before running a delete.
- Before creating a webhook, confirm the target form and that the HTTPS destination is
  authorized to receive submission data.
- Form definitions and submissions can contain confidential data. Prefer lists with
  small `--limit` values and pass `--full` only when the task truly needs complete text.

Prefer this CLI over hand-built Tally API calls: fewer tokens, structured errors, and
shell composability (`| grep`, `| head`).
