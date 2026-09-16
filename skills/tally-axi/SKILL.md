---
name: tally-axi
description: Operate Tally forms, submissions, and webhooks through this repository's AXI executable or its API/MCP adapters. Use when an agent needs to list or inspect Tally forms and submissions, list or manage Tally webhooks, delete a submission, diagnose Tally integration failures, or build and invoke the tally-axi command safely.
---

# Tally AXI

Use the integration in a checkout of the `tally-axi` repository. Keep Tally data and credentials out of source control and agent output.

## Prerequisites

1. Work from the repository root, identified by `package.json`, `axi.json`, and `src/index.ts`.
2. Require Node.js 20 or newer and pnpm. Use Corepack to provide pnpm when appropriate.
3. For the public API backend, require a Tally account with an API key created in Tally settings and access to the requested resources.
4. For MCP, require an MCP-capable host already connected to Tally and authenticated through the host's OAuth flow.
5. Obtain explicit user confirmation immediately before a destructive operation.

Do not fabricate missing credentials, permissions, resource IDs, or confirmation.

## Protect credentials and identifiers

- Supply `TALLY_API_KEY` through the process environment, preferably from a secret manager or a short-lived shell session. For example, read it without echoing, export it, run the command, and `unset TALLY_API_KEY` afterward.
- Never put a real key in a command argument, prompt, chat response, shell history, committed file, test fixture, log, issue, or generated artifact. Do not print the environment or enable shell tracing while a key is present.
- Keep `.env.example` as a placeholder only. Although local `.env*` files are ignored, prefer runtime secret injection over persistent plaintext.
- Never record real credentials **or private Tally form, submission, or webhook IDs** anywhere in the repository or skill. Use obvious synthetic values such as `FORM_ID`, `SUBMISSION_ID`, and `WEBHOOK_ID` in examples and tests. Treat returned submission content as private too; minimize and redact output.

## Build and inspect the executable

From the repository root, install dependencies and build:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

The build creates `dist/index.js` and `dist/tools.json`; do not expect `dist/` in a clean checkout. Inspect the supported contract after setting a placeholder or real runtime key because the CLI validates configuration at startup:

```sh
TALLY_API_KEY=placeholder ./dist/index.js --list-tools
TALLY_API_KEY=placeholder ./dist/index.js --manifest
```

Invoke one operation by sending one JSON request on standard input. This avoids exposing inputs in the process list:

```sh
printf '%s\n' '{"tool":"tally_list_forms","input":{"limit":25}}' | ./dist/index.js
```

The executable emits exactly one JSON response. Check `ok`; on failure, use `error.code`, `error.message`, and any safe `status` or `retryAfterMs`. A nonzero exit status accompanies failures. `--call TOOL JSON` also exists, but prefer stdin, especially if input contains private identifiers.

## Choose an operation

Use only the documented tools and inspect `./dist/index.js --list-tools` when exact schemas are needed.

| Tool | Purpose | Safety |
| --- | --- | --- |
| `tally_list_forms` | List accessible forms; accepts `page` and `limit` | Read |
| `tally_get_form` | Get `formId` | Read |
| `tally_list_submissions` | List submissions for `formId`; accepts pagination | Read private data |
| `tally_get_submission` | Get `submissionId` under `formId` | Read private data |
| `tally_delete_submission` | Permanently delete a submission | Destructive |
| `tally_list_webhooks` | List webhooks for `formId` | Read |
| `tally_create_webhook` | Create a webhook for `formId` and callback `url`; optional event is `FORM_RESPONSE` | Write |
| `tally_delete_webhook` | Permanently delete a webhook | Destructive |

Before either delete, state the exact kind of resource and impact, ask the user to confirm, and wait for an affirmative response. Only then send `"confirm":true` with the required IDs. Never infer confirmation from the original request when impact or target is ambiguous, never bypass validation, and never retry a delete automatically. Webhook creation changes external behavior; verify the target URL and scope before invoking it.

## Select API or MCP behavior

- Use the built CLI for normal repository operation. It always constructs the public API adapter, authenticates `https://api.tally.so` with `TALLY_API_KEY`, and optionally honors `TALLY_API_BASE_URL` and `TALLY_TIMEOUT_MS`.
- Do not set an environment switch to select MCP; none exists.
- Use `TallyMcpAdapter` only from application code that already has an authenticated MCP host. Pass the host's `callTool` implementation into the adapter and inject the adapter into `invoke`.
- Let the MCP host perform server connection and OAuth negotiation. Never reuse `TALLY_API_KEY` as an MCP bearer token and never invent a custom MCP transport or authentication handshake.
- Both adapters expose the same eight logical operations. The CLI's input validation, including destructive confirmation, occurs before an injected backend is called; direct adapter calls do not replace the agent's confirmation duty.

## Troubleshoot safely

- **`CONFIGURATION_ERROR`:** Ensure `TALLY_API_KEY` is set, nonempty, and not whitespace. Ensure `TALLY_TIMEOUT_MS`, if set, is an integer from 100 through 120000. Do not reveal the value while checking it.
- **`AUTHENTICATION_FAILED` / HTTP 401:** Replace an expired, revoked, or malformed API key from Tally settings. Confirm the process received the intended secret without printing it. MCP authentication must instead be repaired in the MCP host's OAuth connection.
- **`AUTHORIZATION_FAILED` / HTTP 403:** Authentication succeeded but the identity lacks access. Verify account/workspace membership, resource ownership, and operation permissions. A different key is appropriate only if the user authorizes it.
- **`NOT_FOUND` / HTTP 404:** Recheck the ID and its parent form without copying private IDs into logs. A resource hidden by permissions may also appear unavailable.
- **`TIMEOUT`:** The default is 10 seconds. Check connectivity and, if justified, raise `TALLY_TIMEOUT_MS` up to 120000. Safe reads retry transient network failures; writes and deletes deliberately do not.
- **`RATE_LIMITED` / HTTP 429:** Honor `retryAfterMs` or `Retry-After`, reduce concurrency, and use pagination. Reads retry at most twice and cap server-directed delay at 30 seconds. Do not blindly retry writes or deletes.
- **`TRANSIENT_FAILURE` or HTTP 5xx:** Retry reads with bounded backoff after the built-in attempts. Reconcile the remote state before manually retrying a write, because its outcome may be uncertain.
- **MCP missing/empty result:** Verify the host connection, OAuth grant, and supported Tally tool names. MCP errors and API errors may differ because the host owns transport and authentication.

Preserve redaction during diagnosis: report stable error codes and sanitized context, never raw authorization headers, tokens, private response bodies, or real resource IDs.
