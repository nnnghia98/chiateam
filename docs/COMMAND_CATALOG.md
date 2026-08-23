# Command Catalog

Status: Approved for implementation
Audit date: 2026-08-03
Approval date: 2026-08-03

## Scope and Sources

This catalog is the Phase 1 decision record for the multi-platform bot refactor.
It covers every slash command found in the active runtime, command files, help
text, README, and command registry.

Sources checked:

- `bot/index.js`
- `bot/commands/index.js`
- `bot/commands/command-registry.js`
- Every non-test file under `bot/commands/`
- The `/start` help text in `bot/utils/messages.js`
- `README.md` and command-related documents
- Existing command tests

## Audit Result

- Active runtime and registry: **34 command names**.
- Implemented but not registered: **4 command names**.
- Listed in README but with no bot handler: **4 command names**.
- Total names reviewed: **42**.
- The command logger writes to stdout only. No retained usage log exists in this
  repository, so usage evidence for every command is currently **Unknown**.
- `/start`, the registry, README, and handler files do not describe one common
  supported command list.

`U` in the tables means usage is unknown and needs production logs or team
feedback.

## Decision Meanings

- **Keep**: Keep the user need, command name, and main behavior.
- **Merge**: Another command solves the same user need.
- **Rewrite**: Keep the user need, but change weak inputs, permissions, safety,
  or output.
- **Deprecate**: Keep temporarily and direct users to a replacement.
- **Remove**: Exclude from the supported bot and shared-core migration.

The project owner approved all decisions below without changes.

## Active Command Inventory

### Help and Bench

| Command       | Runtime | Current user | Purpose and inputs                                                   | State read/write                            | Current output                                  | Platform dependency                    | Usage | Current problems                                                                                                            | Proposed decision |
| ------------- | ------- | ------------ | -------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `/start`      | Active  | Player       | Show help; accepts Telegram mention and unused trailing text         | None                                        | Markdown text                                   | Telegram Markdown and configured topic | U     | Help is manually maintained and does not match every other command source                                                   | **Keep**          |
| `/addme`      | Active  | Player       | Add the current actor to the bench; no arguments                     | Read/write bench                            | Text                                            | Raw Telegram actor, configured topic   | U     | Uses Telegram ID directly and rejects different people with the same first name                                             | **Keep**          |
| `/add`        | Active  | Player       | Add one or more named guests: `/add NAME[, NAME...]`                 | Read/write bench                            | Markdown or text                                | Telegram handler and topic             | U     | Any user can add guests; generated IDs are unstable; a mixed valid/invalid batch can partly write before returning an error | **Rewrite**       |
| `/bench`      | Active  | Player       | Show the current bench; no arguments                                 | Refresh/read bench; no write                | Text roster and count                           | Telegram handler and topic             | U     | Core behavior is clear, but API refresh and Telegram reply are mixed in one handler                                         | **Keep**          |
| `/editbench`  | Active  | Admin        | Select a bench member by button, or use `/editbench NUMBER NEW_NAME` | Read/write bench; temporary interaction map | Buttons, message edit, follow-up text, Markdown | Telegram callbacks and message editing | U     | Temporary interaction state is process-local; adapter and rename rule are mixed                                             | **Keep**          |
| `/clearbench` | Active  | Admin        | Select members by button, number, range, or `all`                    | Read/write bench                            | Buttons, message edit, Markdown text            | Telegram callbacks and message editing | U     | `all` deletes the full bench without confirmation                                                                           | **Rewrite**       |

### Teams and Constraints

| Command           | Runtime | Current user                    | Purpose and inputs                                                            | State read/write                                  | Current output                                   | Platform dependency                    | Usage | Current problems                                                                                                                    | Proposed decision           |
| ----------------- | ------- | ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | -------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `/chiateam`       | Active  | Player for 2 teams; admin for 3 | Assign unassigned bench members: `/chiateam` or `/chiateam 3`                 | Read bench, teams, manifests; write team maps     | Markdown team roster                             | Telegram topic and Markdown            | U     | Permission differs by mode; rerun behavior is not clear from the name; identity and random assignment rules are mixed with Telegram | **Rewrite**                 |
| `/team`           | Active  | Player                          | Show current teams: `/team` or `/team 3`                                      | Refresh/read team maps; no write                  | Markdown team roster                             | Telegram topic and Markdown            | U     | No major user-facing problem                                                                                                        | **Keep**                    |
| `/addtoteam`      | Active  | Admin                           | Add bench members by button, number, range, name, or `all`; optional 2/3 mode | Read bench/team; write selected team              | Buttons, message edit, Markdown text             | Telegram callbacks and message editing | U     | Input is complex; duplicate checks use object identity; mode 2 accepts `EXTRA` while `/clearteam` does not                          | **Rewrite**                 |
| `/clearteam`      | Active  | Admin                           | Remove members or clear a 2/3-team stack                                      | Read/write team maps                              | Buttons, message edit, Markdown text             | Telegram callbacks and message editing | U     | Whole-stack deletion has no confirmation; one command has many ambiguous forms                                                      | **Rewrite**                 |
| `/manifest`       | Active  | Admin                           | Add a same-team or different-team pair by buttons or numbered text            | Read/write manifests; may normalize bench entries | Multi-step buttons, message edits, Markdown text | Telegram callbacks and message editing | U     | Symbols and multi-step input are hard to explain; identity normalization changes bench data inside this command                     | **Rewrite**                 |
| `/mf`             | Active  | Player                          | Short alias that lists manifests                                              | Read manifests                                    | Markdown text                                    | Telegram Markdown                      | U     | Duplicates `/manifests`; abbreviation is unclear to new users                                                                       | **Merge** into `/manifests` |
| `/manifests`      | Active  | Player                          | List current manifests                                                        | Read manifests                                    | Markdown text                                    | Telegram Markdown                      | U     | Missing from `/start` help                                                                                                          | **Keep**                    |
| `/removemanifest` | Active  | Admin                           | Remove one manifest by button or list number                                  | Read/write manifests                              | Buttons, message edit, Markdown text             | Telegram callbacks and message editing | U     | Long name, but the user need is clear and text fallback exists                                                                      | **Keep**                    |
| `/clearmanifests` | Active  | Admin                           | Delete every manifest                                                         | Read/write manifests                              | Text                                             | Telegram handler and topic             | U     | Deletes all constraints without confirmation                                                                                        | **Rewrite**                 |

### Venue, Fees, and Match Result

| Command     | Runtime                      | Current user | Purpose and inputs                                   | State read/write                             | Current output           | Platform dependency                        | Usage | Current problems                                                                                       | Proposed decision                   |
| ----------- | ---------------------------- | ------------ | ---------------------------------------------------- | -------------------------------------------- | ------------------------ | ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `/san`      | Active                       | Player       | Read venue or set it with `/san NAME`                | Read/write process-memory venue map          | Text                     | Uses configured Telegram chat ID and topic | U     | Venue is not persistent; any user can set it; an existing value cannot be replaced until it is cleared | **Rewrite**                         |
| `/clearsan` | Active                       | Admin        | Clear the current venue                              | Write process-memory venue map               | Text                     | Uses configured Telegram chat ID and topic | U     | Operates on non-persistent state                                                                       | **Keep**                            |
| `/tiensan`  | Active                       | Player       | Read or set venue fee with an optional amount        | Read/write persistent `tiensan`              | Text                     | Telegram topic                             | U     | Any user can change the fee; input silently removes non-digits                                         | **Rewrite**                         |
| `/tiennuoc` | Active                       | Player       | Read or set water fee with an optional amount        | Read/write persistent `tiennuoc`             | Text                     | Telegram topic                             | U     | Any user can change the fee; input silently removes non-digits                                         | **Rewrite**                         |
| `/winner`   | Active                       | Player       | Read winner or set `HOME`/`AWAY`; may calculate fees | Read teams, fees, loser; write loser         | Markdown fee/result text | Telegram Markdown and topic                | U     | Any user can change the result; supports only two teams                                                | **Rewrite**                         |
| `/loser`    | Active compatibility command | Player       | Read loser or set `HOME`/`AWAY`                      | Read teams, fees, loser; write loser         | Markdown fee/result text | Telegram Markdown and topic                | U     | Solves the same need as preferred `/winner` with inverse input; omitted from help                      | **Deprecate** in favor of `/winner` |
| `/chiatien` | Active                       | Player       | Calculate the current two-team fee split             | Read fees, winner/loser, and teams; no write | Markdown fee roster      | Telegram Markdown and topic                | U     | Three-team calculation is unsupported, but the missing-state replies are clear                         | **Keep**                            |

### Attendance Vote

| Command      | Runtime | Current user                           | Purpose and inputs                         | State read/write                    | Current output       | Platform dependency                                    | Usage | Current problems                                                                                      | Proposed decision |
| ------------ | ------- | -------------------------------------- | ------------------------------------------ | ----------------------------------- | -------------------- | ------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- | ----------------- |
| `/taovote`   | Active  | Admin to create; player can read usage | Create one attendance vote with a question | Read/write active vote              | Native poll and text | Telegram native poll, poll answers, announcement topic | U     | No non-poll fallback; one global vote; help says four choices but code sends five (`0`, `+1` to `+4`) | **Rewrite**       |
| `/demvote`   | Active  | Player                                 | Show current vote result                   | Read active vote                    | Markdown text        | Telegram poll option shape and Markdown                | U     | Core calculation reads Telegram poll fields directly                                                  | **Keep**          |
| `/sync`      | Active  | Admin                                  | Add attending voters and guests to bench   | Read active vote/bench; write bench | Markdown summary     | Telegram poll option shape                             | U     | Name is broad; generated guest identities are platform-specific and unstable                          | **Rewrite**       |
| `/clearvote` | Active  | Admin                                  | Clear active vote state                    | Read/write active vote              | Text                 | Telegram poll lifecycle                                | U     | Clears stored state but does not close or delete the platform poll                                    | **Rewrite**       |

### Players and Statistics

| Command       | Runtime | Current user                                     | Purpose and inputs                                                        | State read/write                      | Current output     | Platform dependency                  | Usage | Current problems                                                                      | Proposed decision |
| ------------- | ------- | ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------- | ------------------ | ------------------------------------ | ----- | ------------------------------------------------------------------------------------- | ----------------- |
| `/register`   | Active  | Player for self; admin for another player/delete | Self-register by shirt number, create another player, or delete by number | Read/write player database            | Markdown text      | Raw Telegram actor and topic         | U     | One command mixes three permissions and destructive delete syntax                     | **Rewrite**       |
| `/me`         | Active  | Player                                           | Show the current actor and linked player                                  | Read player database                  | Markdown text      | Raw Telegram actor                   | U     | Identity lookup is Telegram-only                                                      | **Keep**          |
| `/players`    | Active  | Player                                           | List registered players with summary statistics                           | Read player and leaderboard databases | Long Markdown text | Telegram message length and Markdown | U     | Large communities may exceed one message; output overlaps inactive `/leaderboard`     | **Keep**          |
| `/player`     | Active  | Player                                           | Show detailed statistics by shirt number                                  | Read leaderboard database             | Markdown text      | Telegram Markdown and cooldown       | U     | Code calls the shirt number `playerId`, which is unclear internally                   | **Keep**          |
| `/edit-stats` | Active  | Admin                                            | Replace match totals using five positional numbers                        | Read/write leaderboard database       | Markdown text      | Telegram Markdown                    | U     | High-risk overwrite with difficult syntax; better suited to a protected admin surface | **Rewrite**       |

### Matches and Maintenance

| Command    | Runtime | Current user                                   | Purpose and inputs                                        | State read/write                                                                | Current output                         | Platform dependency                             | Usage | Current problems                                                                                     | Proposed decision |
| ---------- | ------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| `/match`   | Active  | Player for most actions; admin only for delete | View, save, score, add goal/assist/MVP, or delete a match | Read current venue/fee/teams and player DB; read/write match and leaderboard DB | Markdown text with optional AI summary | Telegram topic/Markdown; optional Gemini result | U     | Too many actions in one parser; save, score, goal, assist, and MVP mutations are not admin-protected | **Rewrite**       |
| `/matches` | Active  | Player                                         | List 1–20 recent matches                                  | Read match database                                                             | Markdown text                          | Telegram Markdown and message length            | U     | No major user-facing problem                                                                         | **Keep**          |
| `/reset`   | Active  | Admin                                          | Reset all persistent next-match state immediately         | Write bench, teams, manifests, fees, result, and active vote                    | Markdown text                          | Telegram topic/Markdown                         | U     | Destructive action has no confirmation                                                               | **Rewrite**       |

## Implemented but Inactive Commands

These files contain handlers, but `bot/commands/index.js` and `bot/index.js` do
not register them. They are also absent from the command registry.

| Command               | Runtime          | Current user | Purpose and inputs                        | State read/write                    | Current output | Platform dependency           | Usage | Current problems                                                           | Proposed decision                                             |
| --------------------- | ---------------- | ------------ | ----------------------------------------- | ----------------------------------- | -------------- | ----------------------------- | ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/leaderboard`        | Inactive handler | Player       | Rank all leaderboard rows                 | Read leaderboard database           | Markdown text  | Telegram Markdown             | U     | Overlaps `/players`; reply recommends inactive `/update-leaderboard`       | **Merge** useful ranking into `/players` if the team needs it |
| `/update-leaderboard` | Inactive handler | Admin        | Apply win/loss/draw or goal/assist deltas | Write leaderboard database          | Markdown text  | Telegram Markdown             | U     | Overlaps `/match` and `/edit-stats`; old complex syntax                    | **Remove**                                                    |
| `/ai`                 | Inactive handler | Player       | Send one prompt to Gemini                 | External AI call; no football state | Markdown text  | Gemini plus Telegram Markdown | U     | Generic AI chat is outside the football core goal                          | **Remove**                                                    |
| `/aichat`             | Inactive handler | Player       | Keep an AI chat session or reset it       | Process-memory AI session           | Markdown text  | Gemini plus Telegram Markdown | U     | Generic AI chat is outside scope; one process-global session can mix users | **Remove**                                                    |

## Documented but Missing Commands

README lists these aliases as active World Cup prediction commands, but no bot
handler, export, or registry entry exists. World Cup prediction HTTP APIs and
admin pages are separate from the Telegram command runtime.

| Command and aliases                     | Runtime    | Current user | Purpose and inputs                                                 | State       | Output | Platform dependency | Usage | Current problems                          | Proposed decision                    |
| --------------------------------------- | ---------- | ------------ | ------------------------------------------------------------------ | ----------- | ------ | ------------------- | ----- | ----------------------------------------- | ------------------------------------ |
| `/pred`, `/predict`, `/worldcup`, `/wc` | No handler | Unknown      | README says World Cup predictions, but defines no command contract | None in bot | None   | None implemented    | U     | Documentation claims unsupported commands | **Remove** from the bot command list |

## Other Runtime Interactions

- `callback-query.js` is a Telegram interaction dispatcher, not a user command.
- `unknown.js` is not registered. Unknown slash commands are intentionally
  ignored.
- `poll_answer` is an event used by `/taovote`, not a command.
- Maintenance mode intercepts every slash command before normal command
  handlers run.

## Approved Final Command Contracts

This is the approved metadata for the supported command manifest. Permissions
apply to the final behavior, including sub-actions.

| Final command     | Decision  | Final permission                              | Arguments                                                                     | Final response                                                           |
| ----------------- | --------- | --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/start`          | Keep      | Player                                        | None                                                                          | Generated help from approved manifest                                    |
| `/addme`          | Keep      | Player                                        | None                                                                          | Joined, duplicate identity/name, or invalid-name result                  |
| `/add`            | Rewrite   | Admin                                         | `NAME[, NAME...]`                                                             | Atomic added/skipped/invalid summary                                     |
| `/bench`          | Keep      | Player                                        | None                                                                          | Empty state, current numbered roster, or repository error                |
| `/editbench`      | Keep      | Admin                                         | Optional `NUMBER NEW_NAME`                                                    | Selection prompt or rename result                                        |
| `/clearbench`     | Rewrite   | Admin                                         | Optional selection, range, or `all`                                           | Selection prompt or removal summary                                      |
| `/chiateam`       | Rewrite   | Admin                                         | Optional mode `2` or `3`                                                      | Missing-player condition or complete assigned teams                      |
| `/team`           | Keep      | Player                                        | Optional mode `2` or `3`                                                      | Empty state or current teams                                             |
| `/addtoteam`      | Rewrite   | Admin                                         | Mode, team, and member selection                                              | Selection prompt or updated team                                         |
| `/clearteam`      | Rewrite   | Admin                                         | Mode, team, selection, or confirmed whole stack                               | Empty state or removal summary                                           |
| `/manifest`       | Rewrite   | Admin                                         | Optional interactive selection or `FIRST SAME\|DIFFERENT SECOND`              | Current constraints, selection prompt, conflict, or saved result         |
| `/manifests`      | Keep      | Player                                        | None                                                                          | Current constraint list; canonical target for the transition alias `/mf` |
| `/removemanifest` | Keep      | Admin                                         | Optional list number                                                          | Selection prompt or removal result                                       |
| `/clearmanifests` | Rewrite   | Admin                                         | Confirmed clear                                                               | Empty state or clear result                                              |
| `/san`            | Rewrite   | Player read; admin write                      | Optional venue name                                                           | Missing venue, current venue, or saved venue                             |
| `/clearsan`       | Keep      | Admin                                         | None                                                                          | Missing venue or clear result                                            |
| `/tiensan`        | Rewrite   | Player read; admin write                      | Optional non-negative integer amount                                          | Missing/current/saved/invalid result                                     |
| `/tiennuoc`       | Rewrite   | Player read; admin write                      | Optional non-negative integer amount                                          | Missing/current/saved/invalid result                                     |
| `/winner`         | Rewrite   | Player read; admin write                      | Optional `HOME` or `AWAY`                                                     | Missing/current/saved result and optional fee split                      |
| `/loser`          | Deprecate | Same during transition                        | Existing input                                                                | Deprecation notice plus `/winner` replacement help                       |
| `/chiatien`       | Keep      | Player                                        | None                                                                          | Missing-condition result or fee split                                    |
| `/taovote`        | Rewrite   | Admin                                         | Question                                                                      | Existing-vote condition or platform-neutral attendance vote              |
| `/demvote`        | Keep      | Player                                        | None                                                                          | No-vote state or current result                                          |
| `/sync`           | Rewrite   | Admin                                         | None                                                                          | No-vote state or atomic bench sync summary                               |
| `/clearvote`      | Rewrite   | Admin                                         | Confirmed clear                                                               | No-vote state or clear/close result                                      |
| `/register`       | Rewrite   | Player for `NUMBER`; admin for `add`/`delete` | `NUMBER`, `add NAME NUMBER`, or `delete NUMBER`                               | Validation, conflict, saved, or deleted result                           |
| `/me`             | Keep      | Player                                        | None                                                                          | Actor and linked-player information                                      |
| `/players`        | Keep      | Player                                        | Optional page/sort after ranking merge                                        | Empty state or paginated player/stat list                                |
| `/player`         | Keep      | Player                                        | Shirt number                                                                  | Invalid, missing, or detailed statistics                                 |
| `/edit-stats`     | Rewrite   | Admin                                         | Explicit named fields or admin-site form                                      | Validation, before/after, or saved result                                |
| `/match`          | Rewrite   | Player read; admin write                      | Explicit `view`, `save`, `score`, `goal`, `assist`, `mvp`, or `delete` action | Action-specific condition and result                                     |
| `/matches`        | Keep      | Player                                        | Optional limit/page                                                           | Empty state or recent match list                                         |
| `/reset`          | Rewrite   | Admin                                         | No arguments; immediate reset                                                 | Completed reset summary                                                  |

## Plain-Text Fallbacks

Every retained interactive command must support these fallbacks:

| Current interaction                | Plain-text fallback                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/editbench` buttons and follow-up | `/editbench NUMBER NEW_NAME`                                                                                                      |
| `/clearbench` buttons              | `/clearbench NUMBER`, ranges, comma list, or `/clearbench all`                                                                    |
| `/addtoteam` buttons               | `/addtoteam MODE TEAM SELECTION`                                                                                                  |
| `/clearteam` buttons               | `/clearteam MODE TEAM SELECTION` or confirmed stack clear                                                                         |
| `/manifest` multi-step buttons     | `/manifest FIRST SAME\|DIFFERENT SECOND` using numbered bench entries                                                             |
| `/removemanifest` buttons          | `/removemanifest NUMBER`                                                                                                          |
| Attendance native poll             | Send numbered text choices and accept a reply of `0`, `+1`, `+2`, `+3`, or `+4` within that command's temporary interaction state |
| Message editing                    | Send a new message with the current page or result                                                                                |
| Telegram topic                     | Send to the source conversation                                                                                                   |
| Markdown                           | Send plain text with formatting markers removed                                                                                   |

## Approved First Independent Command

Use `/bench` for Phase 3.

Reason:

- It is a real football command, not only help text.
- It is read-only.
- It already works from an empty or populated state.
- It does not need another command first.
- Its conditions and replies are small enough to test the core contracts.
- It exercises the state repository and adapter without changing persistent
  storage.

Expected behavior to preserve:

| Starting state    | State change | Reply                                     |
| ----------------- | ------------ | ----------------------------------------- |
| Empty bench       | None         | `⚠️ Bench trống.`                         |
| Populated bench   | None         | Numbered names and total count            |
| API refresh fails | None         | `❌ Không thể tải bench hiện tại từ API.` |

## Test Baseline

- Baseline before new Phase 0 coverage: **77 passed, 0 failed** with
  `node --test`.
- Added `/bench` regression coverage for empty, populated, and API-failure
  states.
- Current suite after adding this coverage: **80 passed, 0 failed** with
  `node --test`.
- Phase 2 runtime and adapter coverage brings the current suite to **92 passed,
  0 failed**.
- The Phase 3 `/bench` proof brings the current suite to **97 passed, 0
  failed**.
- The first Phase 4 migration, `/team`, brings the current suite to **106
  passed, 0 failed**.
- The `/manifests` migration and `/mf` transition bring the current suite to
  **113 passed, 0 failed**.
- The `/chiatien` migration and logical-channel coverage bring the current
  suite to **123 passed, 0 failed**.
- The `/manifest` callback regression and template coverage bring the suite to
  **124 passed, 0 failed**.
- The `/addme` migration, Telegram identity policy, save-failure reply, and
  legacy-state synchronization bring the current suite to **133 passed, 0
  failed**.
- The live Telegram `/addme` checkpoint passed on 2026-08-04.
- The admin-only atomic `/add` migration and shared permission policy bring the
  current suite to **142 passed, 0 failed**.
- The live Telegram `/add` checkpoint passed on 2026-08-05.
- The `/editbench` shared rename rule, callback command routing, paginated
  actions, and adapter-owned follow-up input bring the current suite to **154
  passed, 0 failed**.
- The live Telegram `/editbench` checkpoint passed on 2026-08-05.
- The `/clearbench` atomic selection parser, paginated actions, direct `all`
  action, and API save bring the current suite to **163 passed, 0 failed**.
- The `/chiateam` shared assignment rules, manifest constraints, atomic
  mode-specific save, and admin runtime coverage bring the current suite to
  **178 passed, 0 failed**.
- The live Telegram `/chiateam` two-team and three-team checkpoints passed on
  2026-08-05.
- The existing live Telegram `/addtoteam` flow passed its pre-migration
  checkpoint on 2026-08-05.
- The `/addtoteam` shared selection rules, stable duplicate checks, atomic
  target-team save, and Telegram button coverage bring the current suite to
  **188 passed, 0 failed**.
- The live Telegram `/addtoteam` text and button checkpoints passed on
  2026-08-05.
- The `/clearteam` shared selection rules, atomic target and stack saves,
  confirmation actions, and Telegram button coverage bring the current suite
  to **201 passed, 0 failed**.
- The live Telegram `/clearteam` checkpoint was accepted on 2026-08-05.
- The `/manifest` shared identity, upsert, contradiction, multi-step action,
  and text-fallback coverage bring the current suite to **211 passed, 0
  failed**.
- No database schema or storage behavior changed.

Large handler coverage gaps remain for commands that are not selected as the
first refactor. Add their regression tests immediately before each command is
migrated.

## Approval Record

The project owner approved these decisions on 2026-08-03:

1. The proposed command decisions.
2. Admin-only permission for state-changing `/add`, `/chiateam`, venue, fee,
   result, and match actions.
3. Deprecating `/loser` in favor of `/winner`.
4. Merging `/mf` into `/manifests`.
5. Removing inactive generic AI and old leaderboard-update commands.
6. Removing unsupported World Cup command names from README.
7. Selecting `/bench` as the first independent command.

The project owner changed `/clearbench all` to direct deletion without a
confirmation step on 2026-08-05.

The project owner renamed `/teamthang` to `/winner` and `/teamthua` to
`/loser` on 2026-08-10. The old names are no longer active commands.

This approval allows Phase 2 to create the independent command runtime. Command
removal and behavior changes must still follow the migration phases.
