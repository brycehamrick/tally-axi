---
name: tally-axi
description: Discover and safely invoke the Tally AXI command-line operations for reading Tally forms and submissions and managing Tally webhooks or submission deletion. Use when a task asks to inspect Tally forms or responses, list or fetch submissions, create or inspect webhooks, delete a webhook or submission, diagnose Tally AXI authentication or connectivity, or integrate the repository's JSON stdin/stdout interface.
---

# Tally AXI

Use the repository's narrow, schema-described operations instead of constructing undocumented Tally API requests. Keep credentials and account data out of commands, logs, source files, and responses.

## Check prerequisites

Before invoking the local executable:

1. Use Node.js 20 or newer.
2. Clone or otherwise obtain the public `brycehamrick/tally-axi` repository.
3. Install its dependencies with the package manager represented by `pnpm-lock.yaml`:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

4. Obtain a Tally API key from the authenticated user's Tally settings. Do not ask the user to paste it into chat.
5. Ensure the network can reach the default API endpoint, `https://api.tally.so`, over HTTPS.

The skill supplies operating guidance; it does not bundle the executable, a Tally account, or credentials.

## Configure authentication safely

The executable requires `TALLY_API_KEY` in its process environment. Have the user configure it through their shell's secret facility, a password manager, or the calling agent/runtime's encrypted environment configuration. Never print, return, commit, record, or interpolate the value into a command argument.

For a local interactive shell, prompt without echo and export the captured value:

```sh
read -rsp "Tally API key: " TALLY_API_KEY && printf '\n'
export TALLY_API_KEY
```

Do not run `echo $TALLY_API_KEY`, enable shell tracing, embed the value in JSON, or copy it into `SKILL.md`, source code, issue text, or examples. The repository ignores `.env*` except for its sanitized `.env.example`, but the executable does not require or promise automatic `.env` loading. Prefer process-level secret injection.

Use `TALLY_API_BASE_URL` only for a trusted compatible test server. Do not redirect credentials to an untrusted host. `TALLY_TIMEOUT_MS` is optional and must be an integer from 100 through 120000.

## Discover operations before invoking them

Build first, then ask the executable for its current schemas rather than guessing arguments:

```sh
node dist/index.js --list-tools
node dist/index.js --manifest
```

The current operation families are:

- `tally_list_forms` and `tally_get_form`
- `tally_list_submissions` and `tally_get_submission`
- `tally_delete_submission`
- `tally_list_webhooks`, `tally_create_webhook`, and `tally_delete_webhook`

Treat `--list-tools` as authoritative for required fields, accepted identifier syntax, pagination limits, enum values, and confirmation requirements. Tally AXI intentionally does not provide form creation or editing operations because those operations are not in the mapped public API.

## Invoke an operation

Send exactly one JSON request on standard input. Put the operation in `tool` and its schema-validated arguments in `input`:

```sh
printf '%s\n' '{"tool":"tally_list_forms","input":{"limit":25}}' | node dist/index.js
```

Alternatively, invoke one tool directly with `--call`, passing its JSON input as a single, correctly quoted argument:

```sh
node dist/index.js --call tally_list_forms '{"limit":25}'
```

If the JSON input is omitted, `--call` defaults it to `{}`. Prefer stdin when the caller already speaks the AXI request envelope; prefer `--call` for an intentional interactive invocation. Never put `TALLY_API_KEY` in either JSON form.

The executable writes one JSON response. Check the `ok` field before using `data`. When `ok` is `false`, use the structured error's `code` and sanitized `message`; do not work around validation or expose request headers while diagnosing it.

Use public, non-account-specific placeholders when drafting a request:

```json
{"tool":"tally_get_form","input":{"formId":"FORM_ID"}}
```

Replace placeholders only at execution time with identifiers supplied by the user or returned by a preceding authorized list operation. Do not present placeholder requests as having been executed.

## Handle account data safely

- Establish the intended account, form, and scope before reading data. List forms when the form ID is unknown; do not guess identifiers.
- Treat form definitions and submissions as potentially confidential. Request only the form, page, and fields needed for the task. Do not paste full responses into chat when a count, selected field, or summary is sufficient.
- Keep `formId`, `submissionId`, and `webhookId` distinct. Obtain child identifiers from the correct parent form and verify the relationship before acting.
- Paginate deliberately. Start with a small `limit`, follow the returned pagination data, and stop once the task is satisfied.
- Before creating a webhook, confirm the target form, HTTPS destination, expected `FORM_RESPONSE` event, and the user's authorization to send submission data there. Never use a credential-bearing or untrusted callback URL.
- Treat deletion as irreversible. First fetch or list the target, summarize what will be deleted without disclosing sensitive contents, and ask for explicit user confirmation immediately before invocation. Pass `confirm: true` only after that confirmation. Never infer consent from an earlier read request, batch deletions speculatively, or retry a write/delete automatically.
- If authorization or target identity remains ambiguous, stop and ask the user instead of broadening the query or switching accounts.

## Troubleshoot failures

Use the structured error and HTTP status while keeping secrets redacted:

- **Missing configuration:** If startup says to set `TALLY_API_KEY`, ensure the variable is exported into the same process environment, is nonempty, and contains no accidental surrounding whitespace. Verify presence without revealing the value, for example with `test -n "${TALLY_API_KEY:-}"`.
- **401 / authentication:** The key may be invalid, expired, revoked, or copied incorrectly. Create or rotate it in Tally settings, update the secret store, and retry. Never log request headers or the key during diagnosis.
- **403 / authorization:** Authentication succeeded but the account or token may not have access to the resource or action. Confirm account membership and form access; do not probe other identifiers to bypass the denial.
- **404 / identifier mismatch:** Re-list the relevant resource and confirm the form/submission/webhook pairing. Do not assume a human-facing form slug is an API ID.
- **429 / service errors:** Honor `Retry-After`. Reads may be retried by the client within its documented limits; writes and deletes are not automatically retried because their outcome may be uncertain.
- **Timeout, DNS, TLS, or connection errors:** Confirm HTTPS access to `api.tally.so`, proxy/firewall settings, system time, and DNS. Increase `TALLY_TIMEOUT_MS` only within its supported range. Do not disable TLS verification.
- **Test endpoint issues:** Unset `TALLY_API_BASE_URL` to restore the public endpoint. Before setting it again, verify that the host is trusted because it receives the API credential.

## Use public documentation

Base guidance and examples on the repository's public documentation, never on screenshots, URLs, names, IDs, submissions, or webhook destinations from a private Tally account:

- [Tally AXI README](https://github.com/brycehamrick/tally-axi#readme) documents setup, operation inventory, invocation, response shape, backend behavior, and reliability safeguards.
- [Tally AXI public source repository](https://github.com/brycehamrick/tally-axi) contains the current manifest and tool schemas.
- [Tally developer documentation](https://developers.tally.so/) is the upstream public reference. Use it to explain Tally concepts, but use `--list-tools` to determine what this executable actually supports.

When repository behavior and a remembered example differ, inspect the current public README and generated tool list. Do not use private account data as documentation or as a reusable example.
