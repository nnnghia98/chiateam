# Messenger Adapter

Status: the webhook MVP is implemented locally. Meta App setup, deployment,
webhook subscription, and live tests are still required.

The Messenger adapter reuses the shared football core for:

```text
/start
/poll
/vote 0|1|2|3|4
/demvote
/bench
/team
```

Only `/vote` changes shared state. The other commands are read-only. Admin,
registration, roster, and team-management commands are not registered, so
commands such as `/addme`, `/add`, and `/chiateam` cause no bot action.

The MVP supports Page direct-message text events and plain-text replies. It
does not support attachments, buttons, native polls, group conversations, or
messages outside Meta's allowed messaging window.

## Meta Requirements

Before deployment, create or select:

1. A Facebook Page.
2. A Meta app with the Messenger product and `pages_messaging` permission.
3. A Page access token created by a person with the Page `MESSAGE` task.
4. A random webhook verify token known only to Meta settings and the runtime.
5. A public HTTPS webhook URL with a valid certificate.

Official references:

- [Messenger Platform quickstart](https://developers.facebook.com/docs/messenger-platform/quickstart)
- [Messenger webhooks](https://developers.facebook.com/docs/messenger-platform/webhooks)
- [Send API](https://developers.facebook.com/docs/messenger-platform/send-messages)
- [Meta Messenger Platform API collection](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)

## Environment

Keep real values in the deployment provider and the root `.env` only. Never
commit them.

```dotenv
MESSENGER_PAGE_ID=...
MESSENGER_PAGE_ACCESS_TOKEN=...
MESSENGER_APP_SECRET=...
MESSENGER_VERIFY_TOKEN=...
MESSENGER_GRAPH_API_VERSION=v26.0
MESSENGER_ADMIN_IDS=
MESSENGER_WEBHOOK_URL=https://your-vercel-project.vercel.app/webhook/messenger

BOT_API_BASE_URL=https://your-public-api.example.com
INTERNAL_API_AUTH_TOKEN=...
```

The example uses Graph API `v26.0`, the current Meta release on 2026-09-02.
`MESSENGER_GRAPH_API_VERSION` stays configurable so it can move to a supported
version without a code change. `MESSENGER_ADMIN_IDS` is reserved for future
admin commands; the MVP does not expose any.

## Webhook Behavior

The Vercel function exposes one URL:

```text
GET  /webhook/messenger
POST /webhook/messenger
```

Meta uses `GET` to verify the callback. The function checks `hub.mode` and
`hub.verify_token`, then returns the raw `hub.challenge` text.

For events, `POST` verifies `X-Hub-Signature-256` with HMAC-SHA256 over the
unchanged request bytes before parsing JSON. Each incoming message ID is then
claimed through the existing API, routed once, and marked complete in the
`webhook_events` PostgreSQL table. A failed command releases its claim so Meta
can retry.

Echoes, delivery receipts, read receipts, postbacks, non-text messages, and
malformed events are ignored. The sender's Page-scoped ID identifies the actor
and reply conversation. Until optional profile lookup is added, votes display
that ID as the voter name.

## Deploy and Connect

1. Keep the existing API deployed and healthy.
2. Add all required Messenger, API URL, and internal API token variables to the
   Vercel project in Preview and Production.
3. Deploy a Preview and verify the callback URL with its matching verify token.
4. In the Meta app, subscribe the Page to the `messages` webhook field.
5. Deploy Production and set its stable URL as the callback.
6. Send the live checks below from a Page conversation.

Do not start a local polling process. Messenger delivery is webhook-only.

## Live Checklist

1. Send `/start`; it must list only the six Messenger commands.
2. Send `/addme` and `/chiateam`; the bot must not reply or change state.
3. Create a vote from Telegram with `/taovote QUESTION`.
4. Send `/poll`; it must show the shared vote and five text choices.
5. Send `/vote 2`; it must record the Messenger Page-scoped user.
6. Send `/demvote`; the Messenger voter must appear once.
7. Send `/bench` and `/team`; both must remain read-only.
8. Redeliver one signed webhook payload; it must not run twice.

## Rollback

Disable or remove the callback subscription in the Meta app. This stops new
Messenger events without changing Telegram, Zalo, the API, or stored state.
