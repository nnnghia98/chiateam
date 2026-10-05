# Bot commands and platforms

The bot uses a shared platform-independent command runtime. Telegram input,
output, polls, permissions, and callbacks stay under `platforms/telegram/`.
The shared action list is defined in `core/commands/command-manifest.js`.
Telegram starts these actions from its menu. Zalo and Messenger can still use
slash commands from their smaller platform lists.

Bot replies are in Vietnamese, and fees are in VND. One installation manages
one football community.

## Actions available to the shared bot runtime

| Area             | Commands                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| Help             | `/start`                                                                       |
| Zalo messaging   | `/zalosay`, `/say`                                                             |
| Bench            | `/addme`, `/add`, `/bench`, `/editbench`, `/clearbench`                        |
| Teams            | `/chiateam`, `/team`, `/addtoteam`, `/clearteam`                               |
| Team constraints | `/manifest`, `/mf`, `/manifests`, `/removemanifest`, `/clearmanifests`         |
| Venue and fees   | `/san`, `/clearsan`, `/tiensan`, `/tiennuoc`, `/winner`, `/loser`, `/chiatien` |
| Attendance vote  | `/taovote`, `/vote`, `/clearvote`, `/demvote`, `/sync`                         |
| Players          | `/register`, `/me`                                                             |
| Matches          | `/match`, `/matches`                                                           |
| Admin reset      | `/reset`                                                                       |

`/chiatien` previews the costs, player count, and final HOME/AWAY player amounts
in one group message. It does not show the calculation or result labels.
Each final player fee is rounded up to the next 500 VND.
It sends no payment request. The private fee delivery command is temporarily
disabled. Host bank accounts and fee delivery tables remain in the database
for a later release.

Standalone AI and unsupported World Cup names are not
part of the supported bot runtime.

Send `/start` in Telegram to show the bot description and a reply keyboard
below the message box. The description and keyboard appear in the chat and
topic where you sent `/start`.

Telegram accepts all supported slash commands and alternate names, including
`/reset`, `/vote`, and `/team`. Menu buttons are recommended for convenience;
users can still type commands. The slash menu advertises `/start` to open the
button menu. Admin commands still require admin permission. Zalo keeps its smaller
slash-command list and personal greeting. Sending `/start` does not change
match data or subscribe anyone to announcements.

## Telegram menu

The menu has two buttons per row.

| Menu button        | Action                                    |
| ------------------ | ----------------------------------------- |
| 🗳️ Vote ngay       | Open vote choices                         |
| 🗳️ Tạo vote        | Ask for the new vote question             |
| 📋 Bench           | Show the bench                            |
| ✏️ Sửa bench       | Choose and rename a bench member          |
| 🗑️ Xoá khỏi bench  | Choose members to remove                  |
| 👤 Thêm người      | Ask for guest names                       |
| 🎲 Chia team       | Create two teams                          |
| ⚽ Team            | Show the two-team lineup                  |
| 👥➕ Thêm vào team | Choose a team, then choose bench members  |
| 🗑️ Xoá khỏi team   | Choose a team, then choose what to remove |
| 📊 Kết quả vote    | Show the current vote result              |
| 🔄 Đồng bộ bench   | Copy attending voters to the bench        |
| 📣 Gửi Zalo        | Prepare a Zalo announcement (admin only)  |

Telegram provides the keyboard icon near the message box to hide or reopen
this menu. Its appearance depends on the Telegram app. The menu stays
available after a button press. Each button sends its label as a chat message
and runs the matching internal action with the same permission and pause
checks.
Private command replies stay in the user's chat. Group command results use
their configured channels and topics. Existing
inline buttons stay unchanged. This menu is available only in Telegram.

## Supported platforms

- Telegram is the primary adapter. It accepts all supported slash commands and
  alternate names, with menu buttons recommended for convenience.
- Zalo uses the production webhook and exposes only `/start`, `/zalosay`,
  `/subscribe`, `/unsubscribe`, `/poll`, `/vote`, `/demvote`, `/bench`, and `/team`.
- Zalo roster and team mutation commands are intentionally disabled.
- Messenger has a local webhook MVP with only `/start`, `/poll`, `/vote`,
  `/demvote`, `/bench`, and `/team`.
- Messenger `/vote` is the only write command. Admin, registration, roster,
  and team mutation commands are not available. Delivery is webhook-only.
- One installation manages one football community.

## Private chats and reply templates

Users can open the bot and send `/start` in a private chat. Telegram command
replies stay in that chat even when `CHAT_ID` and group topic IDs are configured.
Group commands keep their configured topic routing. Without `CHAT_ID`, replies
use the incoming chat and topic; group topic settings are ignored.

For use only in private chats, leave `CHAT_ID`, `DEFAULT_THREAD_ID`,
`MAIN_THREAD_ID`, `ANNOUNCEMENT_THREAD_ID`, `VIP_THREAD_ID`, and
`STATISTICS_THREAD_ID` empty. No new bot token or separate bot process is needed.
The API and normal bot process must still be running. Zalo already replies to
the incoming Zalo chat and does not use these Telegram settings.

If managed startup is enabled, change saved settings in the admin panel at
`/bots` and apply them.
Editing `.env` does not replace settings already saved in the admin panel.

Private chats use the same team, bench, match and vote data. Admin commands
still require the configured admin user ID. A confirmed `/zalosay` broadcast
still sends to subscribed Zalo users. `/taovote` still publishes its team poll
to the configured group; without `CHAT_ID`, it uses the incoming chat.

Help and greeting templates use standard emoji with bold section headings.
See [reply templates and private chat setup](CHAT_REPLIES.md) for examples,
platform limits and checks after deployment.

## Command forms worth knowing

- `/zalosay MESSAGE` previews a Zalo subscriber broadcast from Telegram.
  `/say` is an alias. Both accept typed commands; the public Telegram command
  menu still lists only `/start`.
  It is admin-only, requires confirmation within ten minutes, and uses
  `ZALO_BOT_TOKEN` on the Telegram bot service. Each recipient opts in with
  `/subscribe` in a private Zalo chat and can stop with `/unsubscribe`.
  `ZALO_BOT_OWNER_ID` is no longer the broadcast destination.
  See [Zalo broadcast setup](ZALO_BROADCAST.md) for deployment and status commands.
- `/clearvote confirm` requires confirmation.
- `/reset` runs immediately and is admin-only.
- `/register NUMBER`, `/register add NAME NUMBER`, or
  `/register delete NUMBER`.
- `/match view|save|sync|score|winner|loser|goal|assist|mvp|delete ...` uses one explicit action.
- `/match sync [dd/mm/yyyy]` links saved match entries to players who
  registered later. It uses Telegram `user_id` and skips duplicate identities.
  Older unlinked entries without a stored `user_id` must be saved again first.
- `/match winner HOME [dd/mm/yyyy]` or `/match loser AWAY [dd/mm/yyyy]`
  records the result on the saved match and its per-match player rows.
- `/matches [LIMIT] [PAGE]` supports bounded pages.

Interactive commands that use inline keyboards:

- `/clearbench`
- `/editbench`
- `/addtoteam`
- `/clearteam`
- `/manifest`
- `/removemanifest`
- `/clearmanifests`
- `/clearvote`

These commands are admin-only when they show or handle inline keyboard actions.
Inline keyboards show at most 10 players or manifest entries per page. Their
prompt and follow-up messages are sent back to the chat where the command or
button was used, including the same Telegram topic when available, instead of
using the configured `CHAT_ID`.
