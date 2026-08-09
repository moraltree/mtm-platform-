# MTM Platform

Website for Moral Tree Media. See [`CLAUDE.md`](./CLAUDE.md) for architecture,
work-package status, and detailed guidance.

## Structure

- `apps/web` — the website (Next.js, App Router, TypeScript). All new page
  and design-system work happens here.
- `apps/studio` — Sanity Studio (content authoring for `apps/web`). Needs a
  real Sanity project before it can run against live content — see
  [`apps/studio/README.md`](./apps/studio/README.md).
- `backend/` — a legacy Express service. **This runs as a live systemd unit
  (`mtm-backend.service`) — do not modify, restructure, or remove it without
  an explicit migration plan.** It is not part of the npm workspace and is
  not touched by tooling in this repo.

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env.local       # then fill in real values
cp apps/studio/.env.example apps/studio/.env       # needs a real Sanity project — see apps/studio/README.md
npm run dev            # apps/web dev server
npm run dev:studio     # Sanity Studio dev server
```

## Scripts (run from repo root)

| Command                | Effect                                     |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Next.js dev server (`apps/web`)            |
| `npm run dev:studio`   | Sanity Studio dev server (`apps/studio`)   |
| `npm run build`        | Production build of `apps/web`             |
| `npm run build:studio` | Static build of the Studio                 |
| `npm run lint`         | ESLint across all workspaces               |
| `npm run typecheck`    | TypeScript, no emit, across all workspaces |
| `npm run format`       | Prettier, write, whole repo                |
| `npm run format:check` | Prettier, check only, whole repo           |

All of the above exclude `backend/` (see above). A pre-commit hook (Husky)
runs lint, typecheck, and format:check. CI (`.github/workflows/ci.yml`)
additionally runs a full `apps/web` build.

## Environment variables

Documented per-app: `apps/web/.env.example`, `apps/studio/.env.example`.
Copy to `.env.local`/`.env` for local development; never commit real
secrets.
