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

## Unified Telegram destinations

The admin panel at `/bots` supports `TELEGRAM_CHANNEL_ROUTING` with one default
and any additional destinations. Destinations have a Telegram chat ID and an
optional topic ID (`message_thread_id`). A topic ID belongs to its chat; it is
not a standalone destination across groups. No destination names are needed.

- With no default, ordinary replies use the incoming chat and topic.
- With a default, ordinary replies from groups and private chats go there,
  including `/start`, errors, paused notices, maintenance and mention greetings.
- Message-purpose overrides can select a configured destination for main
  messages, announcements, statistics, VIP messages or native attendance polls.
  Unmapped messages use the default (or the source if the default is unset).
- Follow-up prompts are tracked in the destination where they were delivered.
- Explicit recipient-only messages stay private. `/zalosay` and `/say` compose flows stay in their originating
  conversation so drafts, confirmations and Zalo delivery remain compatible.
- A closed or missing topic fails delivery in unified mode. The bot does not
  silently send that message to the group's general chat.

Example:

```json
{
  "default": { "chatId": "-1001234567890", "threadId": "10" },
  "channels": [{ "chatId": "-1001234567890", "threadId": "20" }],
  "routes": { "announcement": "-1001234567890/20", "poll": "-1001234567890/20" }
}
```

Setting `default` to `null` selects source routing. Empty `routes` means all
ordinary messages use the default. Destination keys are `chatId/threadId`, or
`chatId/` for a chat without a topic. Duplicate destinations and routes pointing
to missing destinations are rejected before saving.

Existing `CHAT_ID` and named topic aliases remain supported when the canonical
setting is absent. Applying unified routing takes precedence over those aliases.
Zalo and Messenger routing do not change. One installation still manages one
team; choosing destinations does not create separate data or permissions.

## Local admin panel routing checks

Use a separate test bot and test database for these checks. Each project loads
its own root `.env`; do not create environment-suffixed files.

1. In the bot/backend root `.env`, set the existing admin panel bootstrap
   credentials and encryption key, `MANAGEMENT_API_URL=http://127.0.0.1:8790`,
   and `MANAGEMENT_BOOTSTRAP=true`. See the
   [admin panel guide](BOT_MANAGEMENT_GUIDE.md) for the required credentials.
2. The admin panel web app's root `.env` needs the matching
   `MANAGEMENT_API_URL`, `MANAGEMENT_ADMIN_TOKEN`, and
   `MANAGEMENT_ADMIN_SERVICE_TOKEN`, plus its existing login settings.
3. Start the admin panel backend with `yarn start:admin`, the data API with
   `yarn start:api`, and Telegram with `yarn start:bot`. In `chiateam-admin`,
   run `yarn dev` and open `http://localhost:8389/bots`.
4. Open **Advanced bot configuration**, enable unified routing, leave the
   default unset, Save, then Apply. Verify
   the Telegram service shows **Applied** with the active version. Send a
   command by DM and from a group topic; each reply should stay at its source.
5. Set a test group's chat ID and topic ID as the default. Save creates a draft
   and must not change bot delivery. Apply, verify Telegram's applied version,
   then send `/start` and `/bench` by DM: replies should arrive at the default.
6. Add a second topic by ID and select it for announcements or polls. Save and
   Apply; test that message purpose and an ordinary command to verify the
   override and default separately.
7. Exercise a prompt and follow-up in its destination. Check `/zalosay` stays
   in its originating conversation.

Managed startup is required for admin panel Apply. A bot started without
`MANAGEMENT_BOOTSTRAP=true`, or falling back when settings are unavailable at
startup, uses its root environment and cannot acknowledge Apply. Restart it
with the admin panel backend available to reconnect.
Saving settings is not proof that a running Telegram child applied them. Match
the Telegram service's applied version to the active version and verify delivery.

Automated tests use fake Telegram clients and isolated settings-store fixtures.
They do not send real messages or modify stored football data. Live delivery
must still be checked with the test bot after local Apply.
