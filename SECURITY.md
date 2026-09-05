# Security Policy

## Reporting a problem

Please report security problems privately through GitHub Security Advisories
if that feature is enabled for this repository. If it is not enabled, contact
the project maintainer directly. Do not open a public issue for a live secret,
token, password, database credential, or other sensitive security problem.

Include a short description, affected files or versions, steps to reproduce,
and the possible impact. Please do not include real secrets in your report.

## If a secret is exposed

Rotate or revoke the exposed credential immediately. Then remove it from the
affected service and review logs and access for misuse. Replacing a secret in
the source file alone is not enough.

## Scope

This policy covers the ChiaTeam Bot source code and its documented runtime and
deployment configuration.
