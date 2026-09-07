# Zalo announcements to subscribers

Telegram `/zalosay MESSAGE` now prepares an announcement for **all opted-in
private Zalo chats**, instead of sending immediately to `ZALO_BOT_OWNER_ID`.
It still requires a Telegram admin in `BOT_OWNER_ID` or `BOT_ADMIN_IDS`.

Production checkpoint (2026-09-07): the owner confirmed `/subscribe` works,
then reported that the Zalo bot works properly. The migration's live Zalo
checkpoint is complete based on that report. The deployment steps below remain
the setup guide, not pending work for the current installation.

## Deploy

Subscriber name update: deploy the API first, then the Zalo webhook and Telegram
bot. The API adds a nullable `display_name` column to existing subscription
tables automatically. Existing IDs and subscription choices are preserved.

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

The preview shows the text, recipient count, and inline **✅ Gửi thông báo** and
**❌ Hủy** buttons. **No announcement has been sent yet.** Within ten minutes,
the same admin taps a button in the original Telegram chat/topic. No draft ID
needs to be copied. Repeated taps cannot resend a claimed draft.

The text commands remain available for older previews and manual recovery:

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
start a broadcast from a serverless webhook. Zalo's `/start` help hides
`/zalosay` and its `/say` alias.

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

## Subscriber names

In Telegram, admins can view the active subscribers without sending a broadcast:

```text
/zalosay subscribers
/zalosay subscribers 2
```

Each page shows up to 10 people with their latest saved Zalo display name,
user ID, and chat ID. Missing names appear as `Chưa có tên`. Display names are
labels, not verified player identities; names can repeat or change.

`/subscribe` and `/unsubscribe` save `message.from.display_name` when available.
Later private messages, including plain text and unknown commands, refresh
the name for an existing matching user/chat. They do not create subscriptions,
change chat IDs, or turn notifications back on. Group messages do not refresh
subscriber records. Empty names keep the previous value.

Existing subscribers get names when they next send a private message; they
do not need to register again. Name refresh errors do not stop commands, and the
refresh request has a two-second timeout. The internal `refreshSubscriber` and
`subscribers` API operations require the same admin authentication as broadcasts.

## Storage

Only the API writes these PostgreSQL tables:

- `zalo_announcement_subscriptions`: user/chat IDs, display name, and subscription choice.
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
