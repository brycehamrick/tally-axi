# Contributing to Tally AXI

Thank you for helping improve Tally AXI. Contributions should preserve the CLI's narrow public-API scope, AXI-compliant command behavior, and careful handling of private Tally data.

## Supported development environment

- **Node.js:** 20 or newer. The currently supported release lines are Node.js 20, 22, and 24.
- **npm:** the bundled version ships with Node.js; `package-lock.json` pins the dependency graph.

Confirm the active versions before starting:

```sh
node --version
npm --version
```

## Set up the repository

Fork or clone the repository, then install the locked dependency graph:

```sh
npm ci
```

No Tally credential is needed to build, lint, type-check, or run the automated tests. If you need to exercise configuration locally, export a clearly invented value in your shell. Do not use a production or personal key.

## Development commands

Run each relevant check before opening a pull request:

```sh
# Compile TypeScript into dist/ (dist/ is committed - include it in your change).
npm run build

# Check source formatting and repository lint rules.
npm run lint

# Check TypeScript without emitting build artifacts.
npm run typecheck

# Run the vitest suite (fully mocked network).
npm test
```

## Validate the CLI contract

Behavior changes need the following additional checks.

1. Exercise the built CLI against mocked expectations — the home view and `--help`
   work without credentials:

   ```sh
   npm run build
   node bin/tally-axi
   node bin/tally-axi forms --help
   ```

2. Confirm mutation gates: every destructive command must refuse to run without
   `--confirm` (exit 2) and must make zero network calls in that case. Each gate has a
   test proving this; keep those tests passing.

3. Run the full suite:

   ```sh
   npm test
   ```

Do not add an operation merely because a private or undocumented endpoint appears to exist. Documentation, implementation, and tests must change together whenever the command surface changes.

## Test data and credential safety

**Never commit real Tally API keys, private form IDs, submission IDs, webhook URLs, or private response payloads.** This prohibition applies to source code, tests, fixtures, snapshots, examples, documentation, logs, screenshots, commit messages, and pull-request descriptions.

Use invented fixtures and mocked API responses for every automated test. Use obviously fictional identifiers such as `frmAbc123` and reserved example domains such as `https://example.com/tally-webhook`; do not sanitize and reuse real customer data. Tests must mock network behavior and must not depend on a live Tally account or API.

Before committing, inspect staged content for accidental secrets or private data:

```sh
git diff --cached
git status --short
```

If sensitive material is exposed, stop sharing the branch, revoke the affected credential immediately, and follow `SECURITY.md`. Removing a secret in a later commit does not remove it from Git history.

## Pull-request checklist

Every pull request is expected to confirm that:

- [ ] The change is focused, documented, and limited to supported public Tally operations.
- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test` pass, with `dist/` committed when sources changed.
- [ ] New or changed behavior is covered by deterministic tests using invented fixtures and mocked API responses.
- [ ] Mutations require explicit `--confirm` and writes/deletes are never automatically retried.
- [ ] Error paths preserve credential and response-payload redaction.
- [ ] No real Tally key, private form ID, submission ID, webhook URL, private response payload, or other customer data appears anywhere in the change.
- [ ] Documentation and examples were updated for any user-visible behavior.
- [ ] The staged diff was reviewed before submission.
