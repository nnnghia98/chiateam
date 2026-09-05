# Adapter development

The shared football core handles command rules. A platform adapter translates
an event into a common context and renders a common result back to the user.

## Boundaries

- `core/` contains command contracts, routing, conditions, actions, and
  platform-neutral results.
- `runtime/` wires commands to repositories and starts a bot runtime.
- `platforms/telegram/`, `platforms/zalo/`, and `platforms/messenger/` handle
  input, output, permissions, formatting, buttons, and platform clients.
- `api/` is the data layer and the only persistent-state writer.

Core code must not import Telegram, Zalo, or Messenger clients, message types,
Markdown, or platform event objects. If a platform cannot show a feature (for
example, Telegram buttons or native Zalo polls), the adapter should use a
plain-text fallback.

## Common request

An adapter supplies `command`, `args`, `actor` (`platform`, external ID, and
display name), and `conversation` IDs. The core returns messages and optional
actions. Temporary follow-up input stays in the adapter and expires; raw
platform events do not enter core state.

## Current commands

Telegram runs the full command catalog, including bench, team, vote, player,
match, and admin commands. See [`COMMAND_CATALOG.md`](COMMAND_CATALOG.md).

The Zalo adapter currently exposes:

```text
/start
/zalosay MESSAGE   (alias: /say; admin only)
/poll
/vote 0|1|2|3|4
/demvote
/bench
/team
```

Zalo `/poll` shows the shared Telegram-created vote as text. `/vote` writes to
the same active vote. `/bench` and `/team` are read-only. Roster commands such
as `/addme` and `/chiateam` are not registered on Zalo. See
[`ZALO_ADAPTER.md`](ZALO_ADAPTER.md) for setup and live checks.

The Messenger webhook MVP exposes the same shared vote and read commands,
without Zalo's announcement command:

```text
/start
/poll
/vote 0|1|2|3|4
/demvote
/bench
/team
```

See [`MESSENGER_ADAPTER.md`](MESSENGER_ADAPTER.md) for Meta setup, webhook
security, limits, and live checks.

## Adding an adapter

1. Define the platform event-to-context mapping.
2. Reuse the command registry and core use cases.
3. Add platform permission and identity rules.
4. Render every result, action, and unsupported feature safely.
5. Add adapter and runtime tests, then run `yarn test`.
6. Test shared state with Telegram before enabling production delivery.
