# Zalo announcements to subscribers

Telegram `/zalosay MESSAGE` now prepares an announcement for **all opted-in
private Zalo chats**, instead of sending immediately to `ZALO_BOT_OWNER_ID`.
It still requires a Telegram admin in `BOT_OWNER_ID` or `BOT_ADMIN_IDS`.

## Deploy

1. Deploy the API first. The new internal `/api/zalo-announcements/*` routes
   create the three tables below on their first request. The existing database
   initialization script also ensures them. Do not run the reference schema
   file against an existing database; it is not a migration script.
2. Deploy the Vercel Zalo webhook so it accepts `/subscribe` and `/unsubscribe`.
3. Deploy the Telegram bot, which executes confirmed broadcasts using its
   existing `ZALO_BOT_TOKEN`. It no longer needs `ZALO_BOT_OWNER_ID` as a
   destination. Keep existing owner/admin settings: Zalo still uses them for
   admin permissions. No new env variable is required.

The API and webhook use the existing `BOT_API_BASE_URL` and
`INTERNAL_API_AUTH_TOKEN`. No new Zalo polling process or Vercel background job
is needed. Broadcast delivery runs in the long-running Telegram bot process.

## Use

Each person sends this to the Zalo bot in their **private chat**:

```text
/subscribe
```

The bot confirms the subscription and explains `/unsubscribe`. Simply sending
`/start`, chatting, or voting does not subscribe anyone. Existing webhook
history and the former owner destination are not imported automatically.
Group chats cannot subscribe. One subscription is stored per Zalo user.

A Telegram admin sends:

```text
/zalosay Training starts at 20:00
```

The preview shows the text, recipient count, and commands containing a draft
ID. **No announcement has been sent yet.** Within ten minutes, the same admin
in the same Telegram chat/topic sends the exact confirmation from the preview:

```text
/zalosay confirm DRAFT_ID
```

To cancel an unconfirmed draft or inspect delivery progress:

```text
/zalosay cancel DRAFT_ID
/zalosay status DRAFT_ID
```

`/say` remains an alias. In Zalo itself, `/zalosay MESSAGE` keeps its old
admin-only behavior of replying in the current conversation; it does not
start a broadcast from a serverless webhook.

## Delivery and failure behavior

- Preview snapshots the subscribers. People who subscribe afterward are not
  added to that draft. Opt-outs are checked again immediately before dispatch;
  an already in-flight request cannot be recalled.
- A draft is claimed atomically, once. Repeating its confirmation, even from
  another bot instance, cannot send the same broadcast again.
- Sends are sequential with a one-second pause. This is conservative pacing,
  not a claim about Zalo's official quota. No automatic send retries occur.
- An ordinary recipient rejection is counted as failed; remaining recipients
  are still attempted. A 401, rate limit, network error, or server-side error
  stops the remaining sends. A read-only `getMe` preflight catches invalid
  tokens before consuming the draft.
- Delivery is marked `sending` before the API call and `sent` after Zalo
  acknowledges it. If the process dies or a receipt cannot be saved, status
  shows **sending / unknown**. This does not claim delivery failure or success.
- Progress survives a bot restart. Automatic resume is intentionally not
  supported because uncertain sends could be duplicated. Use `/zalosay status`
  before deciding how to handle remaining or uncertain recipients. Do not
  repeat the whole announcement blindly after a partial failure.
- Reports separate sent, failed, unknown/in-flight, not attempted, and opted-out
  recipients. Safe logs use `[zalo.broadcast]` with error categories; they do
  not include credentials, recipient IDs, message bodies, or raw errors.

## Storage

Only the API writes these PostgreSQL tables:

- `zalo_announcement_subscriptions`: user/chat IDs and subscription choice.
- `zalo_announcements`: immutable text, source admin/chat/topic, confirmation
  expiry, and broadcast status.
- `zalo_announcement_deliveries`: frozen recipient snapshot and delivery status.

All endpoints require existing internal admin authentication. All three tables
have row-level security enabled without public policies. Football state in
`storage`, next-match data, and the JSON backup mirror are unchanged.

## Verification

The normal test suite covers permissions, validation, mocks, HTTP protection,
and safe error reporting. Optional in-memory PostgreSQL tests also exercise
the actual SQL and the complete webhook-to-Telegram broadcast flow:

```sh
BROADCAST_TEST_PGLITE_MODULE=/absolute/path/to/node_modules/@electric-sql/pglite \
  node --test api/routes/zalo-announcements.postgres.test.js
```

Install that test engine in a temporary directory, not production. These tests
use an in-memory database and fake messaging clients; they send no real messages.

Official contracts: [sendMessage](https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage)
requires one `chat_id` per send; [webhooks](https://docs.zaloplatforms.com/docs/BOT/webhook)
provide the private conversation ID.
