# Security Policy

Tally AXI handles authentication credentials and potentially private form and submission data. Please report security problems privately and avoid exposing affected users while a fix is prepared.

## Supported versions

Security fixes are provided for the latest released version and the current default branch. Older releases are not supported; users should upgrade to the newest release before requesting a backport or reporting behavior that may already be fixed.

## Privately report a vulnerability

Use the repository host's **private vulnerability reporting / security advisory** feature when it is available. If it is not available, contact the maintainers through a private channel listed on the repository owner's profile or package metadata and ask for a secure reporting channel. **Do not open a public issue, discussion, or pull request for an unpatched vulnerability.**

Please privately report issues including:

- exposed or logged credentials;
- authentication or authorization defects;
- failures to redact secrets or private response data;
- unintended access to forms, submissions, or webhooks;
- request-validation, injection, dependency, or transport vulnerabilities; and
- any other behavior that could compromise confidentiality, integrity, or availability.

Include, when possible:

- the affected version or commit;
- the feature and configuration involved;
- minimal reproduction steps using invented identifiers and mocked responses;
- the observed impact and your assessment of severity;
- whether exploitation is known to have occurred; and
- a safe way to contact you for follow-up.

Do not include a real API key, private form or submission identifier, webhook URL, private response payload, or other customer data in the report. Redact logs and screenshots. If maintainers need sensitive diagnostic material, agree on an appropriate secure transfer method first.

Maintainers will acknowledge the report, investigate it, coordinate remediation and disclosure with the reporter when practical, and publish an update after users have had a reasonable opportunity to upgrade. Response timing depends on severity and maintainers' availability.

## Suspected credential exposure

If a Tally API key may have been exposed, **revoke it immediately in Tally and replace it with a new key**. Do not wait for confirmation that somebody used it. Remove the key from local configuration, CI variables, logs, and other systems, then update those systems with the replacement. Review relevant account activity and access where possible.

Deleting the key from the latest file or adding a follow-up commit is not sufficient if it entered Git history. Treat the old key as compromised, preserve only safely redacted evidence, and privately tell the maintainers where the exposure occurred so repository history, build artifacts, caches, and published packages can be assessed.

## Safe security research

Use invented fixtures and mocked API responses. Do not test against accounts, forms, submissions, or webhook endpoints you do not own or have explicit permission to assess. Avoid privacy violations, service disruption, destructive actions, and public disclosure before a fix is available.
