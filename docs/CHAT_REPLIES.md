# Reply templates and private chats

Checked on 2026-09-13. This project uses the Zalo Bot API, not the separate Zalo
Official Account API.

## Platform support

| Feature                | Telegram                                                                 | Zalo Bot API                                      |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Normal emoji           | Send as text, for example `⚽`, `✅`, `📊`                               | Send as text with the same icons                  |
| Formatted text         | MarkdownV2 or HTML                                                       | `markdown` or `html`; also supports `text_styles` |
| Current project format | MarkdownV2 for shared rich-text messages                                 | Markdown for shared rich-text messages            |
| Text size limit        | 4096 characters after formatting is parsed                               | 2000 characters                                   |
| Reply destination      | Incoming `message.chat.id`                                               | Incoming `message.chat.id`                        |
| Topics                 | Optional `message_thread_id`; use the incoming topic for a private reply | No topic field in `sendMessage`                   |

Telegram custom emoji require special IDs and eligibility, such as a Premium
bot owner. Standard emoji are simpler for shared templates. Telegram can also
quote an incoming message with `reply_parameters`; sending to the same chat
does not require a quote. See the [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage)
and [formatting options](https://core.telegram.org/bots/api#formatting-options).

Zalo `parse_mode` takes priority over `text_styles`. Style offsets use UTF-16
(JavaScript string positions), which matters for emoji. Zalo `sendMessage`
does not document Telegram custom emoji, inline keyboards, native polls, or
quoted replies. This project shows action commands as text on Zalo. See
[Zalo sendMessage](https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage).

## Templates in this project

The shared help builder is `core/use-cases/common/start-command.js`. It reads
the command list and access rules, then builds headings and command rows.
Telegram and Zalo format those shared segments for their own platform.

The help menu uses `🚀` for quick start, `📚` for the command list, and an icon
for each category. Command names, aliases, admin labels and disabled-command
filters keep their existing behavior. Most football result messages already
have icons.

The first-contact Zalo greeting is built in
`core/use-cases/common/zalo-greeting.js`. The default example is:

```text
👋 Chào Nghia! Đây là bot ChiaTeam.

🔔 /subscribe — Nhận thông báo của đội
🗳️ /poll — Xem vote đang mở
⚽ /team — Xem đội hình
📚 /start — Xem tất cả lệnh
```

Use `ZALO_GREETING_TEXT` to change the greeting. `{name}` inserts the visitor's
name. For example: `👋 Chào {name}! Sẵn sàng ra sân chưa? ⚽`.
The greeting is text; add emoji directly. `/start` escapes this text before
adding bold formatting. Keep shared templates short, with one main icon per
heading. User names and other inserted text must be escaped by the formatter.

Zalo splits long messages at readable boundaries, keeps each part within the
configured limit, and avoids cutting an emoji's surrogate pair (the two
JavaScript string units used for some characters).

## Why private Telegram replies went to the group

Most commands return a named channel such as `main`, `default`, or `statistics`.
The Telegram adapter used `CHAT_ID` and the matching topic setting for those
channels. It did not keep the incoming chat type, so it could not tell a private
chat from a group. `/start` and some interactive prompts already used the source
chat, which made the behavior look inconsistent.

The adapter now keeps the chat type. Private command results, buttons and
follow-up input replies use the incoming chat and topic. The older send helper,
which is still used by maintenance messages, follows the same rule.
Group commands keep their configured channel routing. If `CHAT_ID` is empty,
the incoming chat and topic are used; leftover group topic IDs are ignored.

## Setup for private use

For group and private use together, keep the current group settings. Deploy the
updated code and restart the Telegram process. Users can open the bot and send
`/start`, then `/bench`, `/team` or another supported command.

For use without a group, leave these values empty in the root `.env`:

```dotenv
CHAT_ID=
DEFAULT_THREAD_ID=
MAIN_THREAD_ID=
ANNOUNCEMENT_THREAD_ID=
VIP_THREAD_ID=
STATISTICS_THREAD_ID=
```

Keep the bot token and owner/admin IDs. The bot and API must still be running.
These settings do not block group chats; they remove the fixed group
destination. A separate bot instance is not needed for each user.

With `MANAGEMENT_BOOTSTRAP=true`, use the saved settings on `/bots` and Apply.
After initial setup, changing `.env` alone does not replace managed values.

Zalo already replies to its incoming chat. Do not add a Telegram chat ID or
topic ID to make Zalo private replies work. Keep the current Zalo delivery
method. Do not start polling while its production webhook is active.

## Shared data and deliberate sends

One installation still manages one team. Private users see the same bench,
teams, matches and active vote. Allowed edits affect that shared data. Admin
permissions still depend on the sender's configured user ID.

`/taopoll` deliberately publishes the team poll to `CHAT_ID` and
`ANNOUNCEMENT_THREAD_ID` when a group is configured. Its confirmation or error
returns to the requesting private chat. Without `CHAT_ID`, the poll uses the
incoming chat and topic. Closing an existing vote still closes its stored poll.

A confirmed Telegram `/zalosay` broadcast still sends to subscribed Zalo users.
Private reply routing does not change that broadcast action.

## Checks after deployment

1. Keep a group configured. Send `/bench` and `/team` privately. Replies must
   appear only in that private chat.
2. Use a private inline button or a follow-up text prompt. Its reply must stay
   in the same chat.
3. Run a command in the group. Its existing topic routing must still work.
4. Check `/start` and the Zalo first-contact greeting for readable icons.
5. For a setup without a group, clear the six values above, restart or apply
   settings, then repeat the private checks.

Automated checks use fake clients. They do not send real messages or modify
stored football data. Live delivery must be checked after deployment.
