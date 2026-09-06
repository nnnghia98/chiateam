# Troubleshooting

## Bot does not start

- Check that the root `.env` exists and has the required token and API values.
- Check `DATABASE_URL` and run `yarn init-db`.
- Run the API and bot separately with `yarn dev:api` and `yarn dev:bot`.
- Read the first error in the terminal; do not start a second copy of the
  same polling bot.

## State or votes look wrong

- Confirm both processes use the same `BOT_API_BASE_URL` and
  `INTERNAL_API_AUTH_TOKEN`.
- With `DATABASE_URL`, inspect PostgreSQL `storage`; it is the primary state.
- Check the JSON mirror at the configured `BOT_STATE_FILE`.
- Before repairing state, back up both PostgreSQL and the JSON file.

## Zalo messages are not delivered

- A webhook and long polling cannot run at the same time.
- For local polling, remove the webhook with `yarn zalo:webhook:delete`, then
  run `yarn dev:zalo`.
- For production, check `yarn zalo:webhook:info`, the HTTPS URL, and
  `ZALO_WEBHOOK_SECRET`.
- Confirm the API is public and that the webhook secret and internal API token
  match both deployments.
- Telegram `/zalosay` requires subscribers and a separate confirmation.
  Each person must send `/subscribe` in a private Zalo chat. Check
  `/zalosay status DRAFT_ID` after partial failures; do not resend the entire
  announcement blindly. See [broadcast setup](ZALO_BROADCAST.md).
- A 401 from the broadcast preflight means Zalo rejected `ZALO_BOT_TOKEN`
  on the Telegram bot service. Use the existing working token, not a new
  rotation. Vercel's token alone does not configure the Telegram service.

## A command is missing or denied

- Check `core/commands/command-manifest.js` and the runtime command definitions.
- Check the platform permission policy and configured admin IDs.
- `/zalosay` is admin-only; Zalo intentionally does not register `/addme` or
  `/chiateam`.

## Tests fail

Run the full suite:

```sh
yarn test
```

Then run the smallest failing test file alone. Avoid using production tokens
or production state for tests.
