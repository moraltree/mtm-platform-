# web

The Moral Tree Media website — Next.js (App Router, TypeScript). See the
repo root [`README.md`](../../README.md) for monorepo-wide setup and
[`CLAUDE.md`](../../CLAUDE.md) for architecture/status. Deployment target
(Vercel, `moraltree.media`) is documented in
[`DEPLOYMENT.md`](../../DEPLOYMENT.md).

## Getting started

```bash
cp .env.example .env.local   # then fill in real values — see the file's comments
npm run dev --workspace=web  # from the repo root
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

Run from this directory or via `--workspace=web` from the repo root: `dev`,
`build`, `start`, `lint`, `typecheck`. See the root README for the full
list including cross-workspace commands.
