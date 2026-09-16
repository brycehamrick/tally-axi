# Tally AXI

An AXI command-line integration for Tally. It maps the current public Tally API to one narrowly scoped tool per documented operation while keeping credentials in the environment.

## Agent skill

The repository publishes the `tally-axi` skill from `skills/tally-axi`. Install it with the current `skills` CLI:

```sh
npx -y skills@latest add brycehamrick/tally-axi --skill tally-axi -g
```

## Endpoint inventory

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

The command-line executable uses the **public API backend by default**. `TallyApiAdapter` and `TallyMcpAdapter` both implement the shared `TallyOperations` interface in `src/tally/models.ts`. Applications that already have an MCP host can select MCP by constructing `TallyMcpAdapter` with the host's authenticated `callTool` function and passing that adapter to `invoke`. This follows Tally's hosted-MCP model: the MCP host performs the documented server connection and OAuth negotiation. This package intentionally does not guess at, or reimplement, the transport/authentication handshake and never treats a Tally API key as an MCP bearer token.

The MCP adapter maps equivalent operations to Tally's operation tool names. Backend selection is dependency injection rather than an environment toggle, so an unsupported hand-written MCP transport can never silently replace the API backend.

## Reliability and data handling

Requests time out after 10 seconds by default (`TALLY_TIMEOUT_MS` can select 100–120000 ms). Safe reads retry at most twice for network failures, HTTP 429, and HTTP 5xx responses. Writes and deletes are never retried. `Retry-After` is honored with a 30-second cap. Responses are normalized to typed entities, pages, webhook arrays, or minimal deletion receipts; response headers and credentials are never returned. Upstream diagnostic bodies are recursively redacted.
