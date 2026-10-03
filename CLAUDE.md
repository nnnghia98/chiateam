# Claude Agent Guide

## Rules

Follow the [root Agent Guide](AGENTS.md), including adapter independence and
the configurable default host channel rules.

1. **Always use `yarn`** — Never use `npm` or other package managers. All install, run, and script commands must use `yarn`.
2. **Follow the design system for `admin/` UI** — All UI work in the `admin/` directory must follow the rules defined in [admin/docs/DESIGN.md](admin/docs/DESIGN.md). This includes colors, typography, spacing, shadows, border-radius, and component styles inspired by Airbnb's design system.
