# Agent Guide

## Related Changes

- For every requested change, search for related code and references before editing. Check callers, shared helpers, connected services, tests, settings, scripts, deployment files, examples, and documentation that may be affected.
- Update all affected parts within the requested scope as part of the same task. Follow the adapter independence rules below before changing another adapter.
- Keep the changes within the requested scope. Preserve unrelated work and existing connections unless the requested change requires updating them.
- After editing, check for stale references and run suitable checks. Report any affected part that could not be updated or verified.

## Adapter Independence and Host Channel

- Telegram users can use all supported slash commands and alternate names. Recommend menu buttons for convenience, but do not force users to use them. Keep the same permission checks for typed commands and buttons.

- Each adapter (the code that connects one messaging platform to the bot) is standalone. A change to one adapter does not mean another adapter must change.
- Search related adapters to understand the impact, but keep edits within the requested adapter. If another adapter needs a change, tell the user first. Explain which adapter needs to change and why before editing it.
- Shared core, runtime, and data services may still be reused. Check their impact on all adapters and tell the user first if a shared change requires edits to another adapter.
- Keep cross-platform functions (functions that call another platform), such as `zalosay`, stable during adapter changes. Check both the calling adapter and the receiving adapter. Preserve the command, permissions, message delivery, and existing settings unless the user requests a change. Tell the user first if the work requires changing the connected adapter or the function's behavior.
- Telegram is the default main bot channel for the host. Zalo, Messenger, and other bots are secondary channels by default.
- The user can reconfigure the main and secondary channels. Respect the saved setting; do not force Telegram when the user has chosen another main channel.

## Product Name

- Use **admin panel** as the name for the bot settings and control features in this project.
- Use this name in replies, UI text, documentation, and new agent instructions.
- Call the service that handles these settings the **admin panel backend** (the server that handles admin panel requests). Call the Next.js app the **admin panel web app** when the two need to be distinguished.
- Keep existing API paths, environment variable names, headers, commands, and code identifiers compatible with the bot services. A name change alone must not break these connections.

## Package Manager

- Always use Yarn to install, add, remove, or update dependencies and to run project scripts and tools.
- Never use npm, npx, pnpm, or Bun for these tasks. Use the equivalent command supported by this project's Yarn version.
- Use Yarn commands in documentation, examples, scripts, and automation instructions.
- This rule also applies to commands shown in chat. Run named scripts with `yarn <script>`, such as `yarn build` or `yarn test`.
- Preserve the project's Yarn version and `yarn.lock`. Do not create or update lockfiles from other package managers.

## Git Commit Convention

### Commit Message Format

```
[type]([scope]): [short description]
```

#### Types

- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, dependencies, config
- `refactor` — code restructuring without behavior change
- `docs` — documentation changes
- `style` — formatting, missing semicolons, etc.
- `test` — adding or updating tests

#### Scopes

- `bot` — changes in the `bot/` directory
- `api` — changes in the `api/` directory
- `root` — root-level config files (package.json, Procfile, etc.)

#### Short Description

- Summarize the major changes included in this commit
- Use imperative mood ("add", "fix", "update", not "added", "fixed")
- Keep it concise (under 72 characters)

#### Examples

```
feat(bot): add chia-team shuffle command
fix(api): correct leaderboard score calculation
chore(root): update ci workflow
refactor(bot): extract common utils for commands
docs(root): add git commit conventions
```

## Persistent Bot Storage

- `DATABASE_URL` is mandatory. PostgreSQL table `storage` is the only persistent bot state.
- Missing `DATABASE_URL` must log a clear error and fail the storage operation.
- Never read, write, reset, seed from, or fall back to a bot storage JSON file.
- Next-match data must stay in the `storage` table unless the user approves a storage change.
- Before risky changes to live data, back up the database and restore it if needed.
- Local, Docker, VPS, and Railway use the same database-only storage behavior.

## Environment File Rules

- Every environment owns one root `.env` file with its own values.
- Keep `.env` and `.env.example` organized under two main sections: `BOT` and `API`. Put admin panel backend settings under `API`; explain shared settings in comments rather than duplicating them.
- Keep only settings that a supported runtime, script, or deployment uses. Preserve optional feature settings and supported aliases when they still have consumers. Admin panel web app login settings belong in that app's own environment.
- Runtime and Docker commands must load `.env`; do not select another file with `ENV_FILE`.
- Do not add environment-suffixed runtime files such as `.env.production` or `.env.local`.
- `NODE_ENV` may describe the runtime mode, but it must not select the env file.
- Package scripts must not set `NODE_ENV`; use the value from the environment or root `.env` file.

---

## Trigger: "commit code"

When the user says **"commit code"**, follow these steps exactly:

1. Check which files have been changed using `git status`
2. Stage all relevant changed files with `git add`
3. Compose a commit message following the format above based on the changes
4. Run `git commit -m "[type]([scope]): [short description]"`
5. Confirm the commit was successful

### STRICT RULES

- **NEVER run `git push`** under any circumstances
- **NEVER run `git push --force`** or any push variant
- Only `git add` and `git commit` are permitted
- If multiple scopes are affected, use the most significant scope or list them: `feat(bot, api): ...`
