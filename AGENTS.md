# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

`tally-axi` is an AXI-compliant CLI over the public Tally REST API
(`https://api.tally.so`). It is intended for the [AXI catalog](https://axi.md/).
Keep the AXI principles in mind for every change:

1. TOON output by default, `--json` opt-in
2. 3-4 field list schemas by default
3. Truncate with size hints, `--full` escape hatch
4. Pre-computed aggregates (count, totalCount)
5. Definitive empty states ("0 forms")
6. Structured errors on stdout; exit 2 usage / 1 runtime; unknown flags fail loud; never prompt
7. Ambient context via an installable skill (`skills/tally-axi/SKILL.md`), opt-in only
8. No-args home view is live content, not help
9. `help[]` next-step suggestions after output
10. Every command has a concise `--help`

## Hard rules

- **Never commit secrets.** `TALLY_API_KEY` stays in the environment. Tests must pass
  with no credentials set.
- **Commit `dist/` with every source change.** The build output ships in the repo so
  clone-and-run and GitHub installs need no build step; after editing `src/`, run
  `npm run build` and commit `dist/` in the same change.
- **Network access lives in `src/tally/http.ts` only.** Commands receive an injected
  `TallyOperations`; tests pass a fake. Do not call `fetch` from command code.
- **Mutations require `--confirm`**, verified before any network call. A test must
  exist for each gate proving no client call happens without it.
- **Exit codes:** `VALIDATION_ERROR` (and only it) maps to exit 2; everything else is
  1. The SDK's `exitCodeForError` owns this — do not hand-roll it.
- **Token scrubbing:** every error path passes through `redact()`; upstream diagnostic
  bodies pass through `redactSecrets()`.

## Layout

```
bin/tally-axi.js         entrypoint; fast-path version probe, then dist/
src/lib/                 args (strict parseArgs), env (config + auth gate),
                         output (--json + empty states), redact, truncate
src/tally/http.ts        the only network boundary (retries, timeouts, redaction)
src/tally/api.ts         typed REST adapter for the public Tally API
src/tally/response.ts    upstream response-shape validation
src/commands/            one file per command family
src/index.ts             runAxiCli registration + TallyError -> AxiError boundary
test/                    vitest, fully mocked network
skills/tally-axi/        installable agent skill
```

## Commands

```
npm run build       # tsc -> dist/ (committed to the repo; rebuild on change)
npm test            # vitest run
npm run typecheck
npm run lint
```

Run the CLI locally with `node bin/tally-axi.js` (after `npm run build`). The home
view and `--help` work without credentials; data commands need `TALLY_API_KEY`.

## Scope notes

- Map only operations documented in Tally's public API reference
  (developers.tally.so). Do not invent form create/edit endpoints — they are not in
  the public API.
- The native Tally MCP server is deliberately out of scope for the CLI: it requires
  hosted OAuth negotiation, and its surface is smaller than the REST API.
