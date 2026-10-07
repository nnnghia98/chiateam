# Telegram mentions and Jev text actions

## Mention replies and logs

Messages that tag the running bot are written to server logs under
`[telegram.mention]`. Each entry includes the message text or caption, sender ID,
chat ID, message ID, and message time in UTC. The bot reads its own username
from Telegram, so this works for both development and production bots.
Tagged commands such as `/start@YourBot` also produce a mention log.
Untagged messages do not produce mention logs or greetings. The first mention is
logged immediately and gets a plain-text reply, `Hi [user name]`, in the same
chat and topic. The name uses the sender's first and last name, with username,
chat sender title, or `there` as fallbacks. Messages from bots are ignored.
Further mentions from the same sender in the same chat are ignored
by this listener for five seconds. Other senders and chats have their own
cooldown. This limits mention replies and logs; command handling and existing command
logs still run.
Without Jev, this listener also replies during maintenance mode. With Jev
enabled, it only logs mentions; the Telegram adapter owns greetings and actions.

## ChiaTeam text actions with Jev

Set `TYPESAFE_API_KEY` in the root `.env` to enable TypeSafe Jev for Telegram.
`TYPESAFE_MODEL` defaults to `jev-latest`. Set `TELEGRAM_JEV_ENABLED=false` to
disable it. These settings also reach Telegram when using managed startup.
Keep the key private. No TypeSafe key is passed to Zalo services.

In groups, tag this bot, for example `@YourBot vote` or
`@YourBot hôm nay tôi không đá`. In private chats, send plain text. The adapter
supports Vietnamese and English. It only allows:

- Record the sender's attendance as coming alone or not coming.
- Show the current vote, vote results, bench, or teams.
- Show help or reply to a greeting with `Hi [user name]`.

The exact word `vote` records the sender as coming alone through a fixed code
rule, after removing the bot mention. This does not need an AI call. Longer
requests use Jev and require a clear match.

Other requests, such as currency rates, get a fixed ChiaTeam-only reply.
Unclear requests, requests for another person, guest counts, and low-confidence
answers show the menu. Jev cannot run admin changes or `zalosay` broadcasts.
Existing menu buttons, slash commands, and pending input flows keep working.

The first request runs immediately. The adapter allows one request per sender
and chat every five seconds, one active request per sender and chat, and at most
four active Jev requests in total. Requests time out after eight seconds. An API
failure asks users to use the menu. Existing permissions, disabled command
settings, and paused bot controls still apply. A vote is not recorded if the
poll changed during inference. Votes are saved through the existing API and
storage; Jev does not write state directly or select native Telegram
poll answers on a user's behalf.

Only the message text or caption is sent to TypeSafe, without the bot token,
user ID, chat ID, or roster. TypeSafe's structured Choice API is documented at
[TypeSafe API reference](https://docs.typesafe.ai/api).

The listener can only log messages Telegram delivers. For plain group text
such as `Hi @YourBot`, make the bot a group admin or disable Group
Privacy through BotFather if Telegram does not deliver the message. See
[Telegram's message delivery rules](https://core.telegram.org/bots/faq#what-messages-will-my-bot-get).
Restart the bot after updating the code.

## Jev action logs

Set `TELEGRAM_JEV_SANDBOX=true` locally or on the Railway bot service to log
Jev's chosen action, mapped command, and probability in readable language.
Tagged group messages and private text messages go through Jev before running
one of the six actions: `/vote 1`, `/vote 0`, `/vote`, `/dempoll`, `/bench`, `/team`.
Plain `vote` also goes through Jev. `/start` is not a Jev action option.
Unclear or unmatched requests do not run commands. The normal confidence checks,
cooldown, permission checks, and current-vote checks apply before execution.
Typed slash commands and menu buttons still work normally.
The bot uses one Jev request per accepted message, including when logs are enabled.
Logs include message text, but never the API key. `TYPESAFE_API_KEY` is required;
`TYPESAFE_MODEL` defaults to `jev-latest`. Restart the local bot or deploy Railway
changes to load this behavior. Set `TELEGRAM_JEV_SANDBOX=false` to disable logs
while keeping Jev action routing enabled.
