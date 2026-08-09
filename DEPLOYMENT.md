# Deployment

Hosting decision (made by the owner): **Vercel**. Canonical production
domain: **moraltree.media**. `moraltreemedia.com` — and the `www.`
variant of both domains — redirect permanently (308) to it.

The redirect is implemented at the application level
(`apps/web/next.config.ts`'s `redirects()`, matched on the request's
`Host` header) rather than as a hosting-platform-specific setting, so it
works the same way regardless of where this ends up deployed and can be
tested locally. Verified locally with `next start` + `curl -H "Host:
..."` for all three legacy hosts (apex, and both `www.` variants) —
each 308s to `https://moraltree.media`, preserving the path; the
canonical host and local dev are unaffected.

## Done already (no account access needed)

- [x] Host-based permanent redirects: `moraltreemedia.com`,
      `www.moraltreemedia.com`, `www.moraltree.media` → `moraltree.media`
      (`apps/web/next.config.ts`)
- [x] Every absolute URL (metadata, sitemap, robots, Open Graph) derives
      from `NEXT_PUBLIC_SITE_URL` — nothing is hardcoded to a domain
      anywhere in application code, so setting that one env var in Vercel
      is sufficient
- [x] Security headers, CSP, HSTS already configured (`next.config.ts`)
- [x] No Vercel-specific build output config needed — this is a standard
      Next.js App Router build; Vercel's zero-config Next.js support
      handles it without a `vercel.json`

## Needs Vercel account access (not done this session — stopped here)

1. **Create the Vercel project**
   - Import this Git repository.
   - Framework preset: Next.js (auto-detected).
   - **Root Directory: `apps/web`.** This is an npm-workspaces monorepo
     (root `package.json`'s `"workspaces": ["apps/*"]`) — Vercel detects
     that automatically once Root Directory is set to `apps/web` and
     installs from the repo root while building from there. Don't point
     Vercel at the repo root itself.
   - Don't deploy `apps/studio` or `backend/` as part of this project.
     `apps/studio` (Sanity Studio) is better hosted via Sanity's own
     `sanity deploy` — free, and the conventional way to host a Studio —
     which is a separate decision to make once a real Sanity project
     exists. `backend/` runs live elsewhere already (`mtm-backend.service`
     — see CLAUDE.md) and isn't part of this deploy at all.

2. **Set environment variables** (Project Settings → Environment
   Variables, Production; see `apps/web/.env.example` for the authoritative
   list and what each one does):
   - `NEXT_PUBLIC_SITE_URL=https://moraltree.media` — required. Every
     absolute URL in the site derives from this.
   - `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` —
     once a real Sanity project exists (still an open item, see
     CLAUDE.md). Until then the site keeps building and running fine
     without them.
   - Contact form vars (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
     `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`,
     `CONTACT_FORM_FROM_EMAIL`) — optional at launch; the form works
     without them (honest "not set up yet" message instead of a fake
     success or a crash), so these can follow later.
   - Leave `USE_MOCK_CONTENT` **unset** in every Vercel environment
     (Production and Preview both) — see CLAUDE.md's "Mock content" note.
     It's a local-only visual-review aid, never a production setting.

3. **Add the domains** (Project Settings → Domains):
   - Add `moraltree.media`, set it as the Production Domain.
   - Add `moraltreemedia.com`, `www.moraltreemedia.com`, and
     `www.moraltree.media`. Vercel will offer its own "redirect to
     primary domain" toggle for each — safe to enable alongside the
     application-level redirect already in code; they don't conflict.

4. **DNS** (at whatever registrar/DNS host currently manages these two
   domains — not decided or touched in this repo): point `moraltree.media`
   and `moraltreemedia.com` (and their `www` subdomains) at Vercel, using
   the exact records Vercel's dashboard shows once each domain is added in
   step 3. Vercel provisions and renews TLS certificates automatically
   once DNS resolves correctly — no separate certificate step.

5. **After DNS is confirmed live everywhere**, consider submitting
   `moraltree.media` to the HSTS preload list (hstspreload.org). The
   header is already being sent (`next.config.ts`); submission itself is
   a separate, deliberate step that should only happen once the domain is
   verified reachable over HTTPS from everywhere, not before.

Everything above "Needs Vercel account access" requires the owner's
Vercel account, and steps 3–4 additionally require DNS control this
session doesn't have — that's the intended stopping point.
