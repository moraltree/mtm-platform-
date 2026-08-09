# MTM Platform

Website for Moral Tree Media. See [`CLAUDE.md`](./CLAUDE.md) for architecture,
work-package status, and detailed guidance.

## Structure

- `apps/web` — the website (Next.js, App Router, TypeScript). All new page
  and design-system work happens here.
- `backend/` — a legacy Express service. **This runs as a live systemd unit
  (`mtm-backend.service`) — do not modify, restructure, or remove it without
  an explicit migration plan.** It is not part of the npm workspace and is
  not touched by `apps/web` tooling.

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in real values
npm run dev
```

## Scripts (run from repo root)

| Command                | Effect                                    |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Start the Next.js dev server (`apps/web`) |
| `npm run build`         | Production build                          |
| `npm run lint`          | ESLint (includes accessibility rules)     |
| `npm run typecheck`     | TypeScript, no emit                       |
| `npm run format`        | Prettier, write                           |
| `npm run format:check`  | Prettier, check only                      |

A pre-commit hook (Husky) runs lint, typecheck, and format:check on
`apps/web`. CI (`.github/workflows/ci.yml`) additionally runs a full build.

## Environment variables

Documented per-app in `.env.example` (currently `apps/web/.env.example`).
Copy to `.env.local` for local development; never commit real secrets.
