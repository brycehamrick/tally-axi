# Tally AXI

An AXI command-line integration for Tally. It exposes form, submission, and webhook operations while keeping credentials in the environment.

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
