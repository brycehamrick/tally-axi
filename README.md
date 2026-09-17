# Tally AXI

An [AXI](https://axi.md/)-compliant command line for [Tally](https://tally.so). Read forms and
submissions and manage webhooks through the public Tally REST API with token-efficient
TOON output, pre-computed counts, truncation with a `--full` escape hatch, structured
errors, and `help[]` next steps on every result.

## Install

```sh
npm install -g tally-axi        # or run on demand: npx -y tally-axi@latest <command>
```

Requires Node.js 20 or newer.

## Configure

Create an API key in **Tally settings**, then export it:

```sh
export TALLY_API_KEY="your_tally_api_key_here"
```

The key is read from the environment only — never pass it as a command argument.
Optional overrides: `TALLY_API_BASE_URL` (HTTPS-only, default `https://api.tally.so`)
and `TALLY_TIMEOUT_MS` (100–120000, default 10000).

`tally-axi` with no arguments shows a live home view (auth state, form count, recent
forms) and works without a key, so session-start hooks stay safe.

## Commands

| Command | What it does |
| --- | --- |
| `tally-axi` | Live home view: auth status, form count, recent forms, next steps |
| `tally-axi forms list [--limit N] [--page N]` | Forms shared with the API key |
| `tally-axi forms get <formId> [--full]` | One form definition (truncated by default) |
| `tally-axi submissions list <formId> [--limit N] [--page N]` | Responses for one form |
| `tally-axi submissions get <formId> <submissionId> [--full]` | One response with answers |
| `tally-axi submissions delete <formId> <submissionId> --confirm` | Permanently delete one response |
| `tally-axi webhooks list <formId>` | Webhooks configured on one form |
| `tally-axi webhooks create <formId> --url <https-url> --confirm` | New `FORM_RESPONSE` webhook |
| `tally-axi webhooks delete <webhookId> --confirm` | Unsubscribe an endpoint |

Every command also accepts `--json` (machine-readable JSON instead of TOON) and
`--help`. Tally form creation and editing are not in the public API — create and edit
forms at tally.so, then read them here.

## Examples

```sh
$ tally-axi
bin: ~/.npm-global/bin/tally-axi
description: "Tally forms, submissions, and webhooks for agents - ..."
auth: api-key
forms: 12 shared with this key
recent_forms[5]{id,name,status}: ...
help[4]: ...

$ tally-axi forms list --limit 3
count: 3
totalCount: 12
forms[3]{id,name}: ...
help[2]: ...

$ tally-axi submissions delete frmAbc123 subXyz789 --confirm
deleted:
  id: subXyz789
  form: frmAbc123
help[1]: ...
```

## Safety model

- **Mutations are gated.** `submissions delete`, `webhooks create`, and
  `webhooks delete` refuse to run without `--confirm` (exit 2) and make zero network
  calls until it is present.
- **Writes and deletes are never retried.** Safe reads retry at most twice on network
  errors, 429, and 5xx, honoring `Retry-After` (30s cap).
- **Credentials never leak.** The API key stays in the environment; upstream diagnostic
  bodies are recursively redacted before they reach the terminal; webhook URLs must be
  HTTPS.
- **Timeouts.** Requests abort after `TALLY_TIMEOUT_MS` (default 10s).

## Exit codes

`0` success · `2` usage errors (unknown flags, missing `--confirm`, bad arguments) ·
`1` runtime and API failures. Errors print structured `error` / `code` / `help[]` on
stdout, never stderr, and never prompt.

## Agent skill

An installable skill is bundled for agents that support the format:

```sh
npx skills add brycehamrick/tally-axi
```

## Development

```sh
npm install
npm run build       # tsc -> dist/
npm test            # vitest
npm run typecheck
npm run lint
```

Run the CLI locally with `node bin/tally-axi.js` after building. `dist/` is committed
so clone-and-run and GitHub installs need no build step — after editing `src/`, run
`npm run build` and commit `dist/` in the same change. Network access lives only in
`src/tally/http.ts`; tests inject fakes and never touch the network.

## License

MIT
