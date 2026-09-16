# Tally AXI

An AXI command-line integration for Tally. It maps the current public Tally API to one narrowly scoped tool per documented operation while keeping credentials in the environment.

## Agent skill

The repository publishes the `tally-axi` skill from `skills/tally-axi`. Install it with the current `skills` CLI:

```sh
npx -y skills@latest add brycehamrick/tally-axi --skill tally-axi -g
```

## Public API endpoint inventory

| AXI tool | Public API operation | Safety |
| --- | --- | --- |
| `tally_list_forms` | `GET /forms` | Paginated read |
| `tally_get_form` | `GET /forms/{formId}` | Read |
| `tally_list_submissions` | `GET /forms/{formId}/submissions` | Paginated read |
| `tally_get_submission` | `GET /forms/{formId}/submissions/{submissionId}` | Read |
| `tally_delete_submission` | `DELETE /forms/{formId}/submissions/{submissionId}` | Permanent; `confirm: true` required |
| `tally_list_webhooks` | `GET /forms/{formId}/webhooks` | Read |
| `tally_create_webhook` | `POST /forms/{formId}/webhooks` | Write |
| `tally_delete_webhook` | `DELETE /webhooks/{webhookId}` | Permanent; `confirm: true` required |

This deliberately does not invent form creation/editing operations that are not in Tally's public API reference.

## Setup

Use Node.js 20 or newer and run `pnpm build`. Create an API key in **Tally settings**, then inject it through the `TALLY_API_KEY` environment variable:

```sh
export TALLY_API_KEY="your_tally_api_key_here"
```

The process exits at startup with a configuration error if the variable is missing, empty, or whitespace-only. Never pass the API key as a command argument or save it in repository files. Local `.env*` files are ignored as an additional safeguard; `.env.example` is a sanitized template and contains no usable credential.

The executable reads one request from standard input:

```json
{"tool":"tally_list_forms","input":{"limit":25}}
```

Alternatively, pass the tool name and its JSON input as separate arguments:

```sh
dist/index.js --call tally_list_forms '{"limit":25}'
```

The complete syntax is `dist/index.js --call <tool> <json-input>`. Quote the JSON input as one shell argument; when it is omitted, the input defaults to `{}`.

It writes exactly one JSON response. Successes use `{"ok":true,"data":...}`. Validation, upstream API, and internal failures use `{"ok":false,"error":{"code":"...","message":"..."}}` and a non-zero exit code. Run `dist/index.js --list-tools` for JSON Schema tool definitions or `dist/index.js --manifest` for integration metadata.

## Development

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

`TALLY_API_BASE_URL` may be set for testing against a compatible server. It defaults to `https://api.tally.so`.

## Backends and MCP

The command-line executable uses the **public API backend by default**. Applications that already have an MCP host can construct `TallyMcpAdapter` with the host's authenticated `callTool` function. This follows [Tally's official MCP documentation](https://tally.so/help/mcp): the MCP host performs the server connection and OAuth negotiation. This package intentionally does not guess at, or reimplement, the transport/authentication handshake and never treats a Tally API key as an MCP bearer token.

The native MCP surface is smaller than the public API surface. These are the verified native MCP tools and their upstream arguments:

| Native MCP tool | Upstream arguments | Local adapter method |
| --- | --- | --- |
| `list_workspaces` | none | `listWorkspaces()` |
| `list_forms` | `workspace_id`, `page`, `limit` | `listForms(workspaceId, request)` |
| `get_form` | `form_id` | `getForm(formId)` |
| `list_submissions` | `form_id`, `page`, `limit` | `listSubmissions(formId, request)` |
| `get_submission` | `submission_id` | `getSubmission(submissionId)` |

`list_workspaces` is MCP-only. Submission deletion and all webhook operations in the public API table above are **API-only**; the official MCP server does not expose them, so `TallyMcpAdapter` intentionally does not pretend that it does. The sanitized `tools/list` contract snapshot in `test/fixtures/tally-mcp-tools-list.json` is the source for adapter contract tests and contains neither account identifiers nor submitted form data.

## Reliability and data handling

Requests time out after 10 seconds by default (`TALLY_TIMEOUT_MS` can select 100–120000 ms). Safe reads retry at most twice for network failures, HTTP 429, and HTTP 5xx responses. Writes and deletes are never retried. `Retry-After` is honored with a 30-second cap. Responses are normalized to typed entities, pages, webhook arrays, or minimal deletion receipts; response headers and credentials are never returned. Upstream diagnostic bodies are recursively redacted.
