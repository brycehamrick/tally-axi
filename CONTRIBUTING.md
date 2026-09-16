# Contributing to Tally AXI

Thank you for helping improve Tally AXI. Contributions should preserve the integration's narrow public-API scope, predictable command-line contract, and careful handling of private Tally data.

## Supported development environment

- **Node.js:** 20 or newer. The currently supported release lines are Node.js 20, 22, and 24.
- **pnpm:** 9.x or 10.x. The repository uses pnpm lockfile format 9; do not regenerate the lockfile with another package manager.

Confirm the active versions before starting:

```sh
node --version
pnpm --version
```

## Set up the repository

Fork or clone the repository, then install the locked dependency graph:

```sh
pnpm install --frozen-lockfile
```

No Tally credential is needed to build, lint, type-check, or run the automated tests. If you need to exercise configuration locally, copy `.env.example` outside tracked files or export a clearly invented value in your shell. Do not use a production or personal key.

## Development commands

Run each relevant check before opening a pull request:

```sh
# Compile TypeScript and prepare the executable distribution.
pnpm build

# Check source formatting and repository lint rules.
pnpm lint

# Check TypeScript without emitting build artifacts.
pnpm typecheck

# Build and run the complete Node.js test suite.
pnpm test
```

## Validate the AXI manifest and skill contract

Changes to `axi.json`, `integration.json`, the entrypoint, or tool definitions need the following additional checks.

1. Confirm that both checked-in manifests are valid JSON:

   ```sh
   node -e "for (const file of ['axi.json', 'integration.json']) JSON.parse(require('node:fs').readFileSync(file, 'utf8'))"
   ```

2. Build the package. This also copies the AXI manifest and emits the tool catalog used by the packaged skill:

   ```sh
   pnpm build
   ```

3. Ask the built executable for its manifest and skill/tool schemas. These commands inspect metadata only and do not make a Tally API request:

   ```sh
   node dist/index.js --manifest
   node dist/index.js --list-tools
   ```

4. Verify that the built skill exposes every intended operation, that each input schema matches its implementation, and that destructive tools still require `confirm: true`. Run the integration tests after that review:

   ```sh
   pnpm test
   ```

Do not add an operation merely because a private or undocumented endpoint appears to exist. AXI metadata, documentation, implementation, and tests must change together whenever the public skill contract changes.

## Test data and credential safety

**Never commit real Tally API keys, private form IDs, submission IDs, webhook URLs, or private response payloads.** This prohibition applies to source code, tests, fixtures, snapshots, examples, documentation, logs, screenshots, commit messages, and pull-request descriptions.

Use invented fixtures and mocked API responses for every automated test. Use obviously fictional identifiers such as `form_fixture_123` and reserved example domains such as `https://example.com/tally-webhook`; do not sanitize and reuse real customer data. Tests must mock network behavior and must not depend on a live Tally account or API.

Before committing, inspect both staged content and history-bound metadata for accidental secrets or private data:

```sh
git diff --cached
git status --short
```

If sensitive material is exposed, stop sharing the branch, revoke the affected credential immediately, and follow `SECURITY.md`. Removing a secret in a later commit does not remove it from Git history.

## Pull-request checklist

Every pull request is expected to confirm that:

- [ ] The change is focused, documented, and limited to supported public Tally operations.
- [ ] `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- [ ] AXI manifests and the generated skill/tool schemas were validated when their contract is affected.
- [ ] New or changed behavior is covered by deterministic tests using invented fixtures and mocked API responses.
- [ ] Destructive operations require explicit confirmation and are never automatically retried.
- [ ] Error paths preserve credential and response-payload redaction.
- [ ] No real Tally key, private form ID, submission ID, webhook URL, private response payload, or other customer data appears anywhere in the change.
- [ ] Documentation and examples were updated for any user-visible behavior.
- [ ] The staged diff was reviewed before submission.
