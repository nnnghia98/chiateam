# Agent Guide

## Related Changes

- For every requested change, search for related code and references before editing. Check callers, shared helpers, connected services, tests, settings, scripts, deployment files, examples, and documentation that may be affected.
- Update all affected parts as part of the same task. Do not stop after changing only the named file or command, and do not wait for a separate request to fix related references.
- Keep the changes within the requested scope. Preserve unrelated work and existing connections unless the requested change requires updating them.
- After editing, check for stale references and run suitable checks. Report any affected part that could not be updated or verified.

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

- PostgreSQL table `storage` is the primary persistent state when `DATABASE_URL` is configured.
- The configured `BOT_STATE_FILE` JSON file is still kept as a fallback/backup mirror; default local/VPS path is `/api/data/bot/storage.json`.
- Railway should keep `BOT_STATE_FILE` inside the mounted volume, such as `/data/bot/storage.json` when the volume mount path is `/data`.
- Next-match data must always stay in the `storage` table and the configured JSON mirror unless the user explicitly approves another storage change.
- Before risky changes to that data, make a database backup and a JSON-file backup, then restore them if needed.

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
