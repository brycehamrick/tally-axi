# Tally AXI

An AXI command-line integration for Tally. It exposes form, submission, and webhook operations while keeping credentials in the environment.

## Setup

Use Node.js 20 or newer, set `TALLY_API_KEY`, and run `pnpm build`. Do not put credentials or account identifiers in this repository.

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
