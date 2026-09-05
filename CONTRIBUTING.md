# Contributing

Thank you for helping improve ChiaTeam Bot.

## Before you start

- Read the README and related files in `docs/`.
- Run `yarn setup`, add your own `.env` values, and follow
  `docs/DATABASE_SETUP.md`.
- Use the root `.env` file for local values. Do not add environment-specific
  runtime files such as `.env.local` or `.env.production`.
- Never commit tokens, passwords, database URLs, or other secrets.

## Changes

1. Create a branch for your work.
2. Keep changes small and focused.
3. Keep platform-independent behavior in `core/` when possible. Keep adapter
   code in `platforms/`.
4. Add or update tests for behavior changes.
5. Run `yarn test` and any focused checks that apply to your change. Test live
   integrations only with safe test data.
6. Update documentation when setup, commands, or behavior changes.

Use clear commit messages in this form:

```text
type(scope): short description
```

Examples: `feat(bot): add command`, `fix(api): validate input`.

## Pull requests

Describe what changed, why it changed, and how you tested it. Mention any
environment variables or deployment steps that are needed. A maintainer will
review the change before it is merged.
