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

## Current first-release blocker

The 2026-09-02 audit found credentials and private community data in old Git
history. Removing them only from the latest files is not enough.

Before the first public release:

1. Rotate or revoke the old Telegram, MongoDB, PostgreSQL, and related
   credentials.
2. Make a reviewed repository backup.
3. Rewrite reachable history to remove old tracked env files,
   `bot/storage.json`, historical database files, and sensitive older versions
   of `docs/RAILWAY_SETUP.md`.
4. Coordinate the required force-push with every repository user.
5. Clone the rewritten repository into a new directory and scan it again.

Do not publish or force-push until credential rotation and the history rewrite
plan are both approved.

Local status on 2026-09-02:

- A restricted backup was created outside the repository.
- All local branches and local remote-tracking refs were rewritten to remove
  the audited secret and private-data paths.
- A fresh local clone and strong-pattern scans passed. Safe placeholder
  database URLs remain in example documentation.
- No remote was changed. Credential rotation and the coordinated remote
  history replacement are still required.
