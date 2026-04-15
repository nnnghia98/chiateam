# Admin Repository Split (2026-04-15)

On 2026-04-15, the Next.js admin UI was split out of this repository.

- Previous location: `admin/` inside this repo
- New location: `../chiateam-admin`
- Split method: history-preserving `git subtree split --prefix=admin`

This repository now contains only:

- `bot/`
- `api/`

Docker and CI in this repo now deploy only `api` + `bot`.
