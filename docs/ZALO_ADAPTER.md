# Zalo Adapter

Status: Phase 6 complete. The production Vercel webhook is registered, live
delivery is confirmed, and the restricted-command checklist passed on
2026-09-02. Local polling is stopped.

The Zalo adapter currently reuses the shared football core for:

```text
/start
/zalosay MESSAGE (alias: /say, admin only)
/poll
/vote 0|1|2|3|4
/demvote
/bench
/team
```

Only `/vote` changes state. `/zalosay` sends its text through the Zalo Bot
API without changing stored state. A Telegram admin can also run `/zalosay`;
the Telegram process uses a non-polling Zalo client to post to
the private recipient in `ZALO_BOT_OWNER_ID`, then confirms delivery in
Telegram. Other commands are read-only. Roster and
team-management commands are not registered, so commands such as `/addme` and
`/chiateam` are hidden and cause no bot action.

Zalo has no native poll-send method in its current Bot API. `/poll` renders the
active Telegram-created vote as text choices, and `/vote` stores the Zalo
user's choice in the same active vote.

Telegram and Zalo run as separate processes. They read and write the same bot
state through the API.

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
`/zalosay` in Zalo. `ZALO_BOT_OWNER_ID` is also the private recipient when
Telegram runs `/zalosay`. The owner must open a private chat with the bot
before receiving messages. Telegram authorization uses `BOT_OWNER_ID` and
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

1. Send `/start`. It must list `/zalosay`, `/poll`, `/vote`, `/demvote`,
   `/bench`, and `/team`.
2. As a configured admin, send `/zalosay Hello team`. The bot must post
   `Hello team` in the same Zalo chat.
3. As a Telegram admin, send `/zalosay Hello from Telegram`. The Zalo bot must
   post only `Hello from Telegram` to the owner's private Zalo chat, and
   Telegram must show a short success confirmation.
4. As a non-admin, send `/zalosay Hello team`. The bot must deny it.
5. Send `/addme` and `/chiateam`. The bot must not reply or change state.
6. Create an active vote from the Telegram admin flow with `/taovote QUESTION`.
7. Send `/poll` in Zalo. It must show the question and five text choices.
8. Send `/vote 2`. It must confirm two attendees.
9. Send `/demvote`. The Zalo voter must appear in the shared result.
10. Send `/bench` and `/team`. Both must remain read-only.

Live checkpoint: all steps passed against the production webhook on 2026-09-02.

`/vote 0` records that the user will not attend. Sending another `/vote` value
changes that user's choice.

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

The root `.vercelignore` uploads only the webhook function and the shared files
that it imports. It excludes the existing long-running API server and local env
files.

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
