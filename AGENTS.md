# Agent Guide

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
- `admin` — changes in the `admin/` directory
- `root` — root-level config files (package.json, Procfile, etc.)

#### Short Description

- Summarize the major changes included in this commit
- Use imperative mood ("add", "fix", "update", not "added", "fixed")
- Keep it concise (under 72 characters)

#### Examples

```
feat(bot): add chia-team shuffle command
fix(api): correct leaderboard score calculation
chore(admin): update dependencies
refactor(bot): extract common utils for commands
docs(root): add git commit conventions
```

## Persistent Bot Storage

- `.runtime/bot/storage.json` (via `BOT_STATE_FILE`) is persistent state.
- Next-match data must always stay in that JSON file.
- Before risky changes to that data, make a backup and restore it if needed.
- Do not migrate next-match data anywhere else unless the user explicitly approves that storage change.

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
