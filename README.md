# Tally for AXI

An [AXI](https://axi.md/) command-line integration for the public [Tally API](https://developers.tally.so/). It gives agents small, schema-validated tools for reading forms and submissions and managing webhooks while keeping authentication in the environment.

> [!IMPORTANT]
> This community integration is not affiliated with or endorsed by Tally. Review every destructive request before running it.

## Capabilities

| Tool | Operation | Notes |
| --- | --- | --- |
| `tally_list_forms` | List forms | Paginated read |
| `tally_get_form` | Get a form | Read |
| `tally_list_submissions` | List form submissions | Paginated read |
| `tally_get_submission` | Get a submission | Read; may return respondent data |
| `tally_delete_submission` | Delete a submission | Permanent; requires `confirm: true` |
| `tally_list_webhooks` | List form webhooks | Read |
| `tally_create_webhook` | Create a webhook | Write |
| `tally_delete_webhook` | Delete a webhook | Permanent; requires `confirm: true` |

The integration deliberately does not add form-creation or form-editing tools that are absent from the public API contract.

## Prerequisites

- Node.js 20 or newer.
- pnpm 10 (Corepack can install the pinned version).
- A Tally account and an API key created in Tally settings.
- AXI, when using this package through the AXI shared library.
- An MCP-capable host with a separately authenticated Tally MCP connection, when using the optional programmatic MCP adapter.

## Installation

Clone this repository, then install and build it:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

For local AXI development, point AXI at this integration directory according to the [AXI integration documentation](https://axi.md/). The executable is `dist/index.js`; `axi.json` is its AXI manifest.

## Environment setup

Export credentials in the process environment. Do not put a real key in a command, committed file, issue, log, or screenshot.

```sh
export TALLY_API_KEY="your_tally_api_key"
export TALLY_TIMEOUT_MS="10000" # optional: 100-120000
```

`TALLY_API_BASE_URL` is an optional development override and defaults to `https://api.tally.so`. The checked-in `.env.example` contains placeholders only. This executable does **not** load `.env` files automatically.

## AXI usage

Inspect the machine-readable integration metadata and tool schemas:

```sh
node dist/index.js --manifest
node dist/index.js --list-tools
```

The executable accepts one JSON request on standard input and writes one JSON response:

```sh
printf '%s\n' '{"tool":"tally_get_form","input":{"formId":"form_example_123"}}' \
  | node dist/index.js
```

It can also be called explicitly:

```sh
node dist/index.js --call tally_list_submissions \
  '{"formId":"form_example_123","page":1,"limit":25}'
```

All identifiers above are invented. Successful responses have the shape `{"ok":true,"data":...}`. Errors have the shape `{"ok":false,"error":{"code":"...","message":"..."}}` and set a nonzero exit status.

Deletion requires explicit confirmation:

```sh
printf '%s\n' '{"tool":"tally_delete_webhook","input":{"webhookId":"webhook_example_123","confirm":true}}' \
  | node dist/index.js
```

## MCP usage

The CLI uses the public API backend. Applications that already operate an authenticated MCP host may instead construct `TallyMcpAdapter` with the host's `callTool` function and pass it to `invoke`:

```ts
import { invoke } from "./dist/index.js";
import { TallyMcpAdapter } from "./dist/tally/mcp.js";

const backend = new TallyMcpAdapter({
  callTool: (name, arguments_) => yourMcpHost.callTool(name, arguments_),
});

const result = await invoke(
  { tool: "tally_get_form", input: { formId: "form_example_123" } },
  {},
  backend,
);
```

The host owns MCP transport and OAuth negotiation. An API key is never treated as an MCP bearer token, and this package does not implement a hand-written MCP connection.

## Limitations and data handling

- Tool coverage is limited to the public operations listed above.
- API behavior, permissions, and rate limits remain controlled by Tally.
- List normalization accepts the documented common collection envelopes, but an incompatible upstream response produces `MALFORMED_RESPONSE`.
- Safe reads retry network errors, HTTP 429, and HTTP 5xx at most twice. Writes and deletes are never retried.
- Requests time out after 10 seconds by default; `Retry-After` delays are capped at 30 seconds.
- Submission responses may contain personal or sensitive information. Send the minimum necessary data to agents and logs.
- Upstream diagnostic bodies are recursively redacted for configured credentials, but callers remain responsible for securely handling successful response data.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `CONFIGURATION_ERROR` | Export a nonempty `TALLY_API_KEY` in the same shell that starts AXI. |
| `AUTHENTICATION_FAILED` | Replace a revoked, expired, or mistyped API key. |
| `AUTHORIZATION_FAILED` | Confirm the authenticated account has access to the requested form or operation. |
| `NOT_FOUND` | Check that placeholder IDs were replaced with IDs accessible to the authenticated account. |
| `RATE_LIMITED` / `TRANSIENT_FAILURE` | Wait and retry; reads already honor `Retry-After`, while writes must be reviewed before retrying. |
| `TIMEOUT` | Check connectivity, then optionally raise `TALLY_TIMEOUT_MS` within the supported range. |
| `MALFORMED_RESPONSE` | Confirm the API base URL and version, then capture a sanitized response shape for a bug report. |
| AXI cannot start the integration | Run `pnpm build`, verify Node.js 20+, and inspect `node dist/index.js --manifest`. |

Never paste credentials or real form, workspace, submission, webhook, project, or account values into a bug report. See [CONTRIBUTING.md](CONTRIBUTING.md) for development checks and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## Shared-library metadata

The proposed integration slug and directory name are `tally`. The display name is `Tally`, the runtime is `node`, and the manifest entrypoint is `dist/index.js`. The repository keeps the shared-library discovery descriptor in `integration.json` and the runtime manifest in `axi.json`. Before opening an upstream PR, compare these files and the intended `integrations/tally/` placement with the current [AXI repository contribution guide](https://github.com/kunchenguid/axi/blob/main/CONTRIBUTING.md); upstream requirements take precedence if they change.

## License

Released under the [MIT License](LICENSE), matching AXI's permissive upstream license.
