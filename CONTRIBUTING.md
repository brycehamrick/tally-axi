# Contributing

Thank you for improving Tally for AXI. Contributions must follow the current [AXI contribution guide](https://github.com/kunchenguid/axi/blob/main/CONTRIBUTING.md), its code of conduct, and this repository's security rules.

## Before opening a change

1. Open an issue for substantial behavior or public-contract changes.
2. Never use production data. Tests, examples, fixtures, commits, issues, and screenshots must contain invented identifiers and placeholders only.
3. Never commit API keys, OAuth tokens, cookies, credentials, `.env` files, agent configuration, or unredacted API responses.
4. Keep each tool narrowly scoped and preserve explicit `confirm: true` validation for destructive operations.
5. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Development workflow

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Correct issues reported by `pnpm format:check` before committing. Add or update tests for behavior changes. Tests must use mocked network boundaries and must not call a live Tally account.

## Upstream shared-library checklist

Before proposing inclusion in `kunchenguid/axi`, re-read the upstream checklist and confirm:

- the integration slug and proposed directory are `tally` and `integrations/tally/`;
- `integration.json` discovers `axi.json`, whose `name` is `tally` and display name is `Tally`;
- the runtime, entrypoint, environment declarations, tool schema artifact, and package metadata agree;
- README links resolve after placement in the shared library and all examples remain sanitized;
- the MIT license, contribution guide, security policy, ignore rules, and CI workflow are included;
- dependency install, formatting, lint, type checks, tests, build, and secret scanning pass; and
- generated build output, dependencies, credentials, environment files, and local agent configuration are not committed.

If the latest upstream schema, directory layout, or naming policy differs, update this repository before submitting. Record the upstream revision used for verification in the pull-request description.

## Pull requests

Explain the user-visible change, security implications, tests run, and any known limitation. Keep commits focused and use clear imperative commit subjects. By contributing, you agree that your work is licensed under the repository's MIT License.
