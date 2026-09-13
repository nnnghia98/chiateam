**Command and menu audit — 13 September 2026**

This report traces the active local code. It does not change the menu or bot behavior. It does not test the deployed bot, send messages, or change stored team data. Commands can be paused or limited to admins through the admin panel, so live access can differ from the defaults below.

Telegram registers **31 main commands and 2 alternative names**. The menu opens **13 commands**. Zalo registers **9 main commands and 1 alternative name**.

Sources: [Telegram registration](../runtime/create-command-definitions.js), [command catalog used by help](../core/commands/command-manifest.js), [Telegram menu](../platforms/telegram/reply-keyboard.js), [Zalo registration](../runtime/create-zalo-command-definitions.js).

**The thirteen current menu buttons**

| Button | Command | What happens now |
| --- | --- | --- |
| ➕ Vote +1 | `/addme` | Adds you once to the shared bench (the list used to create teams). Rejects a duplicate identity or name. Does not cast a native poll answer, register your shirt number, or place you into a team. |
| 📋 Bench | `/bench` | Shows the current bench names and count. Does not change anything. |
| 👤 Thêm cầu ngoài | `/add` | Shows how to enter one or more guest names. The names must then be typed with the command. |
| ✏️ Sửa bench | `/editbench` | Opens the member list. Selecting a member asks for the new name. |
| 🗑️ Xoá khỏi bench | `/clearbench` | Opens bench member removal actions. |
| 🎲 Chia team | `/chiateam` | Creates teams from the current bench. |
| ⚽ Team | `/team` | Shows the two-team lineup. Does not create teams. Three-team mode needs `/team 3`. |
| 👥➕ Thêm vào team | `/addtoteam` | Shows how to choose a team. After a team is entered, it opens the bench member list. |
| 🗑️ Xoá khỏi team | `/clearteam` | Opens team member removal actions. |
| 🗳️ Tạo vote | `/taovote` | Shows how to enter the vote question. A vote is published only after the question is supplied. |
| 📊 Kết quả vote | `/demvote` | Shows the current vote question, names and counts for each choice, and total people attending. Does not open, cast, close, or copy votes to the bench. |
| 🔄 Đồng bộ bench | `/sync` | Copies people marked attending in the active vote to the bench. |
| 📖 Hướng dẫn | `/start` | Shows grouped command help and this same thirteen-button menu. |

The menu is a fixed list in `reply-keyboard.js`. A new command does not add a new menu button. Admins and other users see the same buttons. The menu does not check whether a command is paused, whether teams exist, or whether the user has registered. Help hides paused commands, but the fixed menu does not.

Tapping a button submits its text, which the Telegram adapter maps to the command above. Buttons attached to individual messages are separate. Those buttons can open steps such as picking a bench member or confirming a vote closure.

**How to read the full list**

`[VALUE]` means optional input. `NUMBER` is a bench position for bench/team actions, or a shirt number for player actions. `SELECTION` can be positions, comma lists, ranges, or matching names; commands that accept `all` also support all members. `DATE` means `dd/mm/yyyy`.

“Everyone” means the base permission allows any sender. It does not mean the sender must already have a player record. Telegram admins come from `BOT_OWNER_ID` and `BOT_ADMIN_IDS`; Zalo uses its own owner/admin settings. The admin panel may tighten access or pause commands. Sources: [Telegram permissions](../platforms/telegram/permission-policy.js), [Zalo permissions](../platforms/zalo/permission-policy.js), [command rules](../core/commands/managed-command-rules.js).

**Telegram: help and announcements — 2 commands**

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/start`](../core/use-cases/common/start-command.js) | Everyone | Shows help and the fixed menu. Lists command usage, groups, and admin labels. Does not change team data. |
| [`/zalosay [MESSAGE]`](../core/use-cases/common/zalo-broadcast-command.js), also `/say` | Admin | Prepares a Zalo announcement for subscribed users. With no input, offers Text and Image buttons. A draft preview must be confirmed before sending. See its steps below. |

Telegram announcement steps:

| Input | Action |
| --- | --- |
| `/zalosay --text` | Asks for the next text message. |
| `/zalosay --image` | Asks for one image, with an optional caption. |
| `/zalosay MESSAGE` | Creates a text draft directly and shows a preview. |
| `/zalosay --stop` | Cancels the pending input step. |
| `/zalosay subscribers [PAGE]` | Lists users who subscribed to Zalo announcements. |
| `/zalosay confirm ID` | Sends the stored draft. The preview supplies its ID and a send button. |
| `/zalosay cancel ID` | Cancels the stored draft. The preview supplies a cancel button. |
| `/zalosay status ID` | Shows the draft's delivery status. |

Text and captions allow up to 2,000 characters. An image must be at most 5 MB; albums are rejected. Pending input expires after 10 minutes. Delivery progress is stored. An uncertain network result stops further sending to limit duplicate messages. This is the implementation connected by the current Telegram startup code.

**Telegram: bench — 5 commands**

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/addme`](../core/use-cases/bench/addme-command.js) | Everyone | Adds the sender once to the bench. No extra input or guest count is accepted. |
| [`/add NAME[, NAME...]`](../core/use-cases/bench/add-command.js) | Admin | Adds named guests. Skips existing names. With no names, shows usage; there is no next-message prompt. |
| [`/bench`](../core/use-cases/bench/bench-command.js) | Everyone | Shows the bench, or says it is empty. |
| [`/editbench [NUMBER NEW_NAME]`](../core/use-cases/bench/editbench-command.js) | Admin | With no input, shows member buttons, 10 per page. Selecting a member asks for a new name. Full input changes that bench entry directly. |
| [`/clearbench [SELECTION]`](../core/use-cases/bench/clearbench-command.js) | Admin | With no input, shows member buttons and pages. Selecting members removes them. `/clearbench all` and the delete-all button clear the bench immediately, with no confirmation. Existing teams stay as they are. |

There is no active self-leave command. A normal user can add themselves, but an admin must remove a bench entry.

**Telegram: teams and team rules — 8 commands**

A manifest is a rule that asks the team splitter to keep two people together or apart.

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/chiateam [2\|3]`](../core/use-cases/teams/chiateam-command.js) | Admin | Defaults to two teams. Assigns unassigned bench members and keeps existing team members in place. Uses manifest rules. Requires at least 2 or 3 bench members for the selected mode. Running it again does not perform a fresh shuffle. |
| [`/team [2\|3]`](../core/use-cases/teams/team-command.js) | Everyone | Shows the selected team list. Defaults to two teams. No mode-selection buttons. |
| [`/addtoteam [2\|3] HOME\|AWAY\|EXTRA [SELECTION]`](../core/use-cases/teams/addtoteam-command.js) | Admin | Bare command shows usage. After choosing a target, shows bench member buttons and pages. Adds selected members to that team. Keeps the bench and other teams unchanged. `EXTRA` belongs to mode 3. |
| [`/clearteam MODE [TEAM] [SELECTION]`](../core/use-cases/teams/clearteam-command.js) | Admin | Bare command shows usage. `/clearteam 2` or `3` asks before clearing that full team set; use its confirm/cancel buttons. `/clearteam HOME` shows members of the two-team HOME side. `/clearteam 3 EXTRA` selects the third team. Removing selected members or `all` from one side is immediate. |
| [`/manifest [FIRST SAME\|DIFFERENT SECOND]`](../core/use-cases/teams/manifest-command.js) | Admin | With no input, opens three button steps: first member, together/apart, second member. Full input saves directly. The same pair replaces its earlier rule. Rules affect future assignments; they do not move existing players. |
| [`/manifests`](../core/use-cases/teams/manifests-command.js), also `/mf` | Everyone | Lists current team rules. `/mf` works but shows a notice to use `/manifests`. |
| [`/removemanifest [NUMBER]`](../core/use-cases/teams/removemanifest-command.js) | Admin | With no input, lists rules as buttons with pages. Selecting a rule removes it without confirmation. Button IDs identify the rule so a stale list position does not remove a different rule. |
| [`/clearmanifests [confirm\|cancel]`](../core/use-cases/teams/clearmanifests-command.js) | Admin | With no input, asks for confirmation. Confirm removes all team rules. Cancel keeps them. |

Two-team and three-team lists are stored separately. `/addtoteam` checks duplicates inside the target team only. It does not move a person out of another team. These details matter when a future menu uses labels such as “Move player” or “Shuffle again.”

**Telegram: venue, costs, and fee result — 7 commands**

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/san [NAME]`](../core/use-cases/management/san-command.js) | Everyone reads; admin changes | No input shows the current venue. A name saves the venue for the next match. |
| [`/clearsan`](../core/use-cases/management/clearsan-command.js) | Admin | Clears the current venue immediately. |
| [`/tiensan [AMOUNT]`](../core/use-cases/management/tiensan-command.js) | Everyone reads; admin changes | Shows or sets the venue cost. Accepts a whole number of zero or more. Zero is shown as no cost set. |
| [`/tiennuoc [AMOUNT]`](../core/use-cases/management/tiennuoc-command.js) | Everyone reads; admin changes | Shows or sets the water cost, with the same number rules. |
| [`/winner [HOME\|AWAY]`](../core/use-cases/management/winner-command.js) | Everyone reads; admin changes | Shows or sets the winning side for the current fee split. Saves the opposite side in `teamThua`. Can also show the calculated fees. Does not update a saved match or player wins/losses. |
| [`/loser [HOME\|AWAY]`](../core/use-cases/management/loser-command.js) | Everyone | Old command. Only explains the matching `/winner` command. It does not change data. |
| [`/chiatien`](../core/use-cases/management/chiatien-command.js) | Everyone | Calculates the two-team fee split. Everyone shares venue cost; the losing side shares water cost. Amounts are rounded up per person. Does not save a payment or record who paid. |

These commands have no step-by-step input buttons. With no winner set, `/chiatien` only splits the venue cost equally; water is not included in that fallback. Fee splitting does not support three-team-only data. If both team modes have data, it uses the two-team lists. Source: [fee calculation](../core/use-cases/management/two-team-fee.js).

**Telegram: attendance vote — 4 commands**

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/taovote [QUESTION]`](../core/use-cases/management/taovote-command.js) | Everyone sees usage; admin creates | Bare command shows help. A question, up to 300 characters, creates a Telegram poll. Only one shared vote can be active. Choices are `0`, `+1`, `+2`, `+3`, `+4`. |
| [`/demvote`](../core/use-cases/management/demvote-command.js) | Everyone | Shows names and vote counts per choice, plus total people attending. No action buttons. |
| [`/sync`](../core/use-cases/management/sync-command.js) | Admin | Copies attending voters and their guests into the bench. Skips existing identities. Only adds entries; it does not remove people after a reduced/cancelled vote. Keeps the poll open. |
| [`/clearvote [confirm\|cancel]`](../core/use-cases/management/clearvote-command.js) | Admin | Bare command shows confirmation buttons. Confirm tries to close the Telegram poll and clears the shared vote. Cancel keeps it. Local vote data is cleared even if closing the external poll fails; the reply reports that failure. |

`+N` means N people total, including the voter. For example, `+2` adds the voter and one guest during `/sync`. `0` means not attending. The `/demvote` footer says “Số người vote”, but its value is total people attending, including guests, rather than the number of accounts that voted. Source: [vote totals](../core/use-cases/management/attendance-vote.js).

Telegram users vote through the Telegram poll itself. `/poll` and `/vote` are not Telegram commands in the active registration. Joining through `/addme` does not set a vote choice.

**Telegram: players — 2 commands**

| Command | Access | Current action and input behavior |
| --- | --- | --- |
| [`/register NUMBER`](../core/use-cases/players/register-command.js) | Everyone | Registers the sender with a shirt number. Can claim a matching player slot created by an admin. Bare `/register` shows help. Does not join the bench or vote. |
| Same command: `/register add NAME NUMBER`; `/register delete NUMBER` | Admin | Adds a player slot or deletes a player record by shirt number. Delete has no confirmation step. |
| [`/me`](../core/use-cases/players/me-command.js) | Everyone | Shows sender details and, when registered, their name and shirt number. |

Player commands have no step-by-step buttons. They use stored player records rather than only next-match bot settings.

**Telegram: saved matches — 2 commands**

[`/matches [LIMIT] [PAGE]`](../core/use-cases/matches/matches-command.js) lists saved matches, newest first. Everyone can use it. Default is 10 matches on page 1; the maximum limit is 20. For example, `/matches 10 2` shows the second page. It has no page or match-detail buttons.

[`/match`](../core/use-cases/matches/match-command.js) opens text help. Its actions are:

| Input | Access | Current action |
| --- | --- | --- |
| `/match view [DATE]` | Everyone | Shows the saved match and its lineup, with an optional generated summary. |
| `/match save [DATE]` | Admin | Creates or updates the match from current venue, venue cost, and team data. Replaces saved lineup rows. Requires at least one member and a venue name or positive venue cost. |
| `/match sync [DATE]` | Admin | Links saved lineup entries to players who registered later. This is different from `/sync`, which copies voters into the bench. |
| `/match score 3-2 [DATE]` | Admin | Sets the saved HOME–AWAY score. It does not set the winner. |
| `/match winner HOME\|AWAY [DATE]` | Admin | Records the saved match winner and per-match player results. Rejects a conflict with an existing score or a draw score. |
| `/match loser HOME\|AWAY [DATE]` | Admin | Applies the same per-match result using the opposite side as winner. Unlike bare `/loser`, this action changes data. |
| `/match goal NUMBER COUNT [DATE]` | Admin | Adds COUNT goals to a player in the saved match. It adds to the match count; it does not update a career total. |
| `/match assist NUMBER COUNT [DATE]` | Admin | Adds COUNT assists to a player in the saved match. |
| `/match mvp NUMBER [DATE]` | Admin | Sets the match MVP (best player), replacing the earlier choice. |
| `/match delete DATE` | Admin | Deletes the saved match and its related lineup/stat rows immediately. Requires a date. |

When DATE is omitted, these actions use the **most recent Thursday, including today if it is Thursday**. On Monday–Wednesday this means the previous week's Thursday, not the upcoming match. These commands have no selection buttons or next-message prompts. Sources: [date helper](../core/use-cases/matches/match-date.js), [match API](../api/routes/matches.js).

The current save action reads `teamA`, `teamB`, and `team3C`. It does not read `team3A` or `team3B`. Therefore, saving after a three-team split does not use that mode's HOME/AWAY lists. This is a current code gap, not a proposed behavior. Source: [lineup builder](../core/use-cases/matches/match-lineup.js).

**Telegram: reset — 1 command**

[`/reset`](../core/use-cases/management/reset-command.js) is admin-only and runs immediately, with no confirmation. It clears the bench, both team modes, team rules, venue, venue cost, water cost, fee winner/loser, and active vote. It tries to close the poll first, but still resets local state if closing fails. It does not delete registered players or saved match history.

**Zalo: all 9 commands**

| Command | Access | Current action |
| --- | --- | --- |
| `/start` | Everyone | Shows a greeting and the smaller Zalo help list. |
| `/zalosay MESSAGE`, also `/say` | Zalo admin | Sends the supplied text into the current Zalo conversation. This is not the Telegram subscriber-broadcast flow. It is registered but hidden from Zalo `/start` help. |
| `/subscribe` | Everyone, private chat only | Registers this user/chat to receive team announcements on Zalo. |
| `/unsubscribe` | Everyone, private chat only | Stops that subscription. |
| `/poll` | Everyone | Shows the active shared vote with text instructions for `/vote 0` through `/vote 4`. |
| `/vote 0\|1\|2\|3\|4` | Everyone | Sets or changes the sender's attendance choice. Also accepts `+1` through `+4`. Zero means not attending; N means N people total. Does not directly add anyone to the bench. |
| `/demvote` | Everyone | Shows the shared vote results. |
| `/bench` | Everyone | Shows the shared bench. |
| `/team [2\|3]` | Everyone | Shows two-team or three-team lists. Defaults to two teams. |

Zalo does not have the thirteen-button Telegram menu in this adapter. Its formatter renders action choices as text commands. It has no active `/addme`, `/register`, player-statistics, saved-match, fee, team-editing, or vote-creation command. Sources: [Zalo registration](../runtime/create-zalo-command-definitions.js), [formatter](../platforms/zalo/formatter.js), [subscriptions](../core/use-cases/common/zalo-subscription-command.js), [vote action](../core/use-cases/management/vote-command.js).

**Reply destination and shared data**

In the current local code, normal Telegram replies to a private message stay in that private chat. In groups, some results use the configured default, main, announcement, or statistics topic. Replies marked `source` stay where the command was sent. Buttons attached to messages use these same routing rules.

Creating a vote is an explicit publication action: `/taovote QUESTION` publishes the poll to the configured group and announcement topic when present. Without a configured group, it publishes to the source conversation. Telegram `/zalosay` explicitly sends confirmed announcements to subscribed Zalo users. Other Zalo replies go to the incoming conversation.

Private chat does not create separate team data for each user. The bench, teams, team rules, costs, and active vote are shared. A change made by an allowed user in private chat changes that shared data.

Sources: [Telegram adapter](../platforms/telegram/adapter.js), [poll publisher](../platforms/telegram/attendance-vote-publisher.js), [Zalo adapter](../platforms/zalo/adapter.js).

**What the main menu currently leaves out**

The 18 missing main commands cover bench removal, more team editing and rules, venue and costs, shirt registration, saved-match actions, Zalo announcements, and reset. The thirteen visible commands also hide their alternatives, such as `/team 3`.

Existing button flows already cover `/editbench`, `/clearbench`, target-specific `/addtoteam` and `/clearteam`, `/manifest`, `/removemanifest`, `/clearmanifests`, `/clearvote`, and Telegram `/zalosay`. The main menu now opens `/editbench`, `/clearbench`, `/clearteam`, and `/addtoteam` directly. The other flows still need a typed command.

Behavior details to keep in view when choosing improvements:

- Join, vote, and register are separate actions. There is no normal-user self-leave command.
- Team creation adds unassigned members; it does not reshuffle current teams.
- Clearing the bench leaves existing teams. Adding to a team does not move a person out of another team.
- `/winner` handles fee state. `/match winner` handles saved match results and player statistics.
- `/sync` only adds attending people. Reducing a vote later does not remove earlier bench entries.
- Some delete actions ask for confirmation, while `/clearbench all`, `/register delete`, `/match delete`, and `/reset` act immediately.
- Player and match lists need typed commands for later pages and detail views.
- Three-team saving and fee support are incomplete, as described above.

**Scope and checks**

The audit follows the active command registration through handlers, permissions, button builders, platform adapters, and relevant storage/API calls. It does not count old files as live commands. The football leaderboard commands and API have been removed. The separate World Cup prediction leaderboard remains. The older [command catalog](COMMAND_CATALOG.md) is a historical decision record, so active code takes priority here.

The focused registry, reply-menu, and help checks passed: **15 tests**. Command: `yarn test runtime/create-command-definitions.test.js runtime/telegram-reply-keyboard.test.js platforms/telegram/reply-keyboard.test.js runtime/start-help.test.js`. This verifies local behavior with test doubles (fake external services), not delivery through the live bots.
