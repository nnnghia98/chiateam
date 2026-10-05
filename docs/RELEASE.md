# Release guide

Releases use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- `PATCH`: backward-compatible bug fix or docs-only fix.
- `MINOR`: backward-compatible feature.
- `MAJOR`: breaking command, API, data, or configuration change.

## Checklist

- [ ] Confirm the migration plan phase and release scope.
- [ ] Run `yarn test` and review every failure.
- [ ] Check `git status`; keep secrets, `.env` files, and local state out of
      the release.
- [ ] Scan the full history and current diff for tokens, passwords, webhook
      secrets, and private URLs.
- [ ] Rotate any credential that was exposed; update every deployment.
- [ ] Test setup from a clean clone with the documented root `.env`, database
      setup, and commands.
- [ ] Update README and relevant docs, including command and adapter changes.
- [ ] Review database and state backups before any production migration.
- [ ] Bump `package.json` version using SemVer.
- [ ] Create a git tag matching the version, for example `v1.3.0`.
- [ ] Create the release notes from the tag and include upgrade or rollback
      notes.
- [ ] Verify the deployed API, Telegram bot, and Zalo webhook after release.

Do not push from this guide. A maintainer reviews and publishes the tag and
release through the approved repository workflow.

## History cleanup (2026-10-05)

An audit found credentials and private community data in old Git history.
Removing them only from the latest files is not enough, so history was rewritten.

Done:

- A backup of all refs was made outside the repository.
- Old tracked env files, bot state files, a historical database file, and a
  player roster file were removed from all commits. Remaining secrets and
  personal data were replaced with placeholders or fake values.
- The rewritten history was force-pushed to all branches.
- A fresh clone passed gitleaks and pattern scans.
- GitHub Support was asked to remove cached views and pull request references
  to the old commits.

Rules after a history rewrite:

- Do not merge or push from a clone made before the rewrite. Re-clone instead.
- Rotate any credential that was ever committed, even after it is removed from
  history.
- Before publishing a release, scan the full history again with gitleaks.
