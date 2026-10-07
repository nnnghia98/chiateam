# Zalo Adapter

Status: Phase 6 complete. The production Vercel webhook is registered, live
delivery is confirmed, and the restricted-command checklist passed on
2026-09-02. The owner confirmed `/subscribe` works and reported the Zalo bot
working properly on 2026-09-07, completing the subscriber broadcast checkpoint.
Local polling is stopped.

The Zalo adapter currently reuses the shared football core for:

```text
/start
/zalosay MESSAGE (alias: /say, admin only)
/subscribe (private chat only)
/unsubscribe (private chat only)
/poll
/vote
/dempoll
/bench
/team
```

Only `/vote` changes football state. `/subscribe` and `/unsubscribe` store
announcement preferences separately. Zalo `/zalosay` sends its text to the
current conversation. Telegram `/zalosay` now previews and confirms a broadcast
to opted-in Zalo subscribers, not the single owner chat. See
[broadcast setup and recovery](ZALO_BROADCAST.md). Other commands are read-only. Roster and
team-management commands are not registered, so commands such as `/addme` and
`/chiateam` are hidden and cause no bot action.

Zalo has no native poll-send method or message buttons in its current Bot API.
`/poll` shows the active Telegram-created vote, tells users to send `/vote`,
and lists two text choices. Bare `/vote` lists the same choices with commands:
`/vote 1` means “⚽️ Đá” and `/vote 0` means “🫷 Thôi”. Both choices update the
same active vote.

Telegram and Zalo run as separate processes. They read and write the same bot
state through the API.

Private replies use the `chat.id` from each incoming Zalo message. Telegram
`CHAT_ID` and `*_THREAD_ID` settings do not affect them. Standard emoji work in
the greeting and help menu. See [reply templates and private chats](CHAT_REPLIES.md).

## Greeting

After the first private message, the bot sends a short greeting using the Zalo
display name (or `bạn` when no name is available) and the commands `/subscribe`,
`/poll`, `/team`, and `/start`. Text, image, sticker, and voice messages can
trigger this greeting. Captions and media are never executed as commands.

When enabled, `/start` shows the greeting with the available Zalo command list.
It hides paused commands and `/zalosay` (including `/say`), and marks commands
that require admin access. `/unsubscribe` remains listed even if command rules
try to pause it. A first message of `/start` receives one combined reply.
Any other first command is still run after the greeting. There are no
automatic greetings in group chats or replies
to bot accounts. Zalo does not document an event for simply opening a chat.

The API records a one-time claim per user in the private PostgreSQL table
`zalo_greetings`. Greetings do not subscribe users or change football state.
Claims survive restarts and concurrent messages. The claim is saved before
sending; if delivery fails or is uncertain, it is not retried automatically.
Users can always send `/start` again. Greeting failures do not stop commands.

Deploy the API first, then the Zalo webhook. The new table is created
automatically on the first `/api/zalo-greetings/claim` request or by the existing
database initialization script. The endpoint requires internal admin auth.
Existing users receive their one-time greeting on their next private message
after this change is deployed. No past chats are messaged automatically.

## Create and Configure the Bot

1. In Zalo, search for the official **Zalo Bot Manager** account.
2. Create a bot. Zalo requires the bot name to start with **Bot**.
3. Copy the token sent by Zalo Bot Manager.
4. Add these values to the local **.env** file:

```dotenv
ZALO_BOT_TOKEN=...
ZALO_BOT_OWNER_ID=...
ZALO_BOT_ADMIN_IDS=...
```

`ZALO_BOT_OWNER_ID` and `ZALO_BOT_ADMIN_IDS` control who may run
`/zalosay` in Zalo. `ZALO_BOT_OWNER_ID` is no longer a Telegram broadcast
destination. Each recipient must open a private chat and send `/subscribe`.
Telegram authorization uses `BOT_OWNER_ID` and
`BOT_ADMIN_IDS`.

Official references:

- [Create a bot](https://docs.zaloplatforms.com/docs/BOT/create_bot)
- [Authentication](https://docs.zaloplatforms.com/docs/BOT/authorize)
- [Use the Bot API](https://docs.zaloplatforms.com/docs/BOT/call_api)

## Local Test

Keep the API running in its current terminal. Start Zalo in another terminal:

```sh
yarn dev:zalo
```

Live checklist:

1. Send `/start`. It must list `/subscribe`, `/unsubscribe`, `/poll`,
   `/vote`, `/dempoll`, `/bench`, and `/team`. It must hide `/zalosay` and `/say`.
2. As a configured admin, send `/zalosay Hello team`. The bot must post
   `Hello team` in the same Zalo chat.
3. In Zalo, send `/subscribe`. As a Telegram admin, send
   `/zalosay Hello from Telegram`, then tap **✅ Gửi thông báo** in the
   preview. Only subscribed recipients should receive the message, and
   Telegram must show delivery counts. See the broadcast guide before live testing.
4. As a non-admin, send `/zalosay Hello team`. The bot must deny it.
5. Send `/addme` and `/chiateam`. The bot must not reply or change state.
6. Create an active vote from the Telegram admin flow with `/taopoll QUESTION`.
7. Send `/poll` in Zalo. It must show the question, two text choices, and tell users to send `/vote`.
8. Send `/vote`. It must list “⚽️ Đá” (`/vote 1`) and “🫷 Thôi” (`/vote 0`).
9. Send `/vote 1`, then `/vote 0`. The second choice must replace the first.
10. Send `/dempoll`. The Zalo voter must appear in the shared result.
11. Send `/bench` and `/team`. Both must remain read-only.

Historical checkpoint: the original non-broadcast steps passed against the
production webhook on 2026-09-02. The subscriber broadcast checkpoint was
completed from the owner's live report on 2026-09-07. This records working
production use, not new live tests of every failure or restart case.

`/vote 0` records that the user will not attend. Sending `/vote 1` or `/vote 0`
again replaces that user's earlier choice when it changes.

Long polling and webhooks cannot run at the same time. If this bot already has
a webhook, remove it before this local test. Zalo recommends long polling only
for development.

- [getUpdates](https://docs.zaloplatforms.com/docs/BOT/apis/getUpdates)
- [sendMessage](https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage)

## Production Webhook on Vercel

The Vercel project contains one Node.js function:

```text
POST /webhook/zalo
GET  /webhook/zalo
```

`POST` verifies `X-Bot-Api-Secret-Token`, claims the Zalo message through the
existing API, runs the shared command, and then completes the claim. `GET` is a
small health response.

The existing API remains the only PostgreSQL writer. Its authenticated
`/api/webhook-events/*` routes store short processing leases and completed
message IDs in `webhook_events`. This prevents two Vercel instances from
processing the same vote. A failed command releases its claim so Zalo can retry.

The root `.vercelignore` keeps only the webhook entries from the API directory
and leaves shared source trees available. Vercel's file tracing selects the
files that each function uses, so new helpers in those trees do not need a new
per-file ignore rule. It excludes the existing long-running API server and
local env files.

### Vercel Environment

Set these values in both Preview and Production:

```dotenv
ZALO_BOT_TOKEN=...
ZALO_BOT_OWNER_ID=...
ZALO_WEBHOOK_SECRET=...
BOT_API_BASE_URL=https://your-public-api.example.com
INTERNAL_API_AUTH_TOKEN=...
```

`BOT_API_BASE_URL` must be the public HTTPS address of the existing API. The
internal token must match the API deployment.

Use the Node.js runtime. In the Vercel project settings, choose a function
region close to the existing API and PostgreSQL region.

### Safe Deployment Order

1. Deploy the API changes first. The API creates `webhook_events` when it is
   first needed; `yarn init-db` also creates it.
2. Import this repository as a separate Vercel project. Use the repository root
   and the **Other** framework preset.
3. Add the four required Vercel environment variables.
4. Deploy a Preview and open `/webhook/zalo`. It must return
   `{"ok":true,"service":"zalo-webhook"}`.
5. Test the Preview, then deploy Production. Do not register a changing Preview
   URL with Zalo.
6. Put the stable production URL in the local environment's `.env`:

   ```dotenv
   ZALO_WEBHOOK_URL=https://your-vercel-project.vercel.app/webhook/zalo
   ```

7. Register and verify it from this repository:

   ```sh
   yarn zalo:webhook:set
   yarn zalo:webhook:info
   yarn zalo:webhook:test
   ```

8. After registration succeeds, stop the local `yarn dev:zalo` polling shell.
9. Repeat the live checklist from the Local Test section.

Zalo tests the HTTPS URL and secret during `setWebhook`. Polling and webhook
delivery cannot run together.

### Rollback

Remove the webhook before returning to local polling:

```sh
yarn zalo:webhook:delete
```

Then start the polling shell yourself and repeat `/start` and `/poll` checks.

- [Build with a webhook](https://docs.zaloplatforms.com/docs/BOT/best-practices/build-your-bot-with-webhook)
- [Webhook events](https://docs.zaloplatforms.com/docs/BOT/webhook)
- [setWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook)
- [Vercel Functions](https://vercel.com/docs/functions)

Do not run `yarn dev:zalo` after the production webhook is active.
