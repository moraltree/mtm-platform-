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

## Done already

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
- [x] **Vercel project created** (`moral-tree-media`, linked via
      `apps/web/.vercel/project.json` — gitignored, re-run `vercel link`
      from `apps/web` if a fresh clone needs it relinked), **root directory
      `apps/web`**, deployed via the Vercel CLI (`vercel --prod` from
      `apps/web`) rather than a GitHub-integration auto-deploy — there is
      no Vercel GitHub App connected to this repo, so pushing to `main`
      alone does **not** trigger a deploy; run `vercel --prod` again after
      pushing when a production release is actually wanted.
- [x] **`NEXT_PUBLIC_SITE_URL=https://moraltree.media` set** in the
      Production environment (`vercel env ls` shows it; verified live —
      `sitemap.xml`/`robots.txt` on the real domain already use it, not
      `localhost`).
- [x] **`moraltree.media` added as a domain and live**: `vercel domains ls`
      shows it under the project, and `curl https://moraltree.media/`
      returns 200 with a valid cert and the site's own security headers.
      DNS isn't delegated to Vercel's nameservers — inspecting the domain
      shows third-party `name.com` ones instead — so this is presumably
      record-level (A/CNAME) DNS at the registrar, a legitimate way to
      point a domain at Vercel and clearly working. Don't assume "switch
      to Vercel nameservers" is a remaining step here.

## Still needs account/DNS access

- [ ] **`moraltreemedia.com`, `www.moraltreemedia.com`, `www.moraltree.media`
      are not yet added/resolving** — `vercel domains ls` lists only the
      apex `moraltree.media`. Confirmed precisely (not just "DNS is slow"):
      connecting directly to Vercel's edge IP with the legacy hostname
      forced via `curl --resolve` fails the **TLS handshake itself**
      (`SSL_ERROR_SYSCALL` — no cert presented for that name), because
      Vercel won't terminate TLS for a hostname that isn't added to _any_
      project on the account. The application-level 308 redirect
      (`next.config.ts`) is already correct and tested locally for all
      three; it can't run for real traffic until each domain is added to
      the Vercel project (which provisions the cert) and DNS points it
      there — same as the canonical domain already is. Adding a domain is
      exactly the "domain verification" step this repo's tooling
      deliberately doesn't do on its own — see the top of this file.
- [ ] Sanity project credentials (`NEXT_PUBLIC_SANITY_PROJECT_ID`/
      `_DATASET` in Vercel, `SANITY_STUDIO_PROJECT_ID`/`_DATASET` in
      `apps/studio`) — still doesn't exist; site runs fine without it (see
      CLAUDE.md), just serving null-state fallbacks instead of real
      content.
- [ ] Contact form vars (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
      `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`,
      `CONTACT_FORM_FROM_EMAIL`) — optional; form works without them
      (honest "not set up yet" message).
- [ ] **Shop / Stripe (WP7) — no real Stripe account exists yet.** Same
      category as Sanity/DNS above: an external-account step for the
      owner, not something this repo's tooling does on its own. Once a
      Stripe account exists (**test mode** unless explicitly told to go
      live): set `STRIPE_SECRET_KEY` in Vercel (Production environment);
      add a webhook endpoint in the Stripe Dashboard pointing at
      `https://moraltree.media/api/stripe/webhook`, subscribed to at
      least `checkout.session.completed`, `customer.subscription.deleted`,
      and `charge.refunded`, then set the signing secret it gives you as
      `STRIPE_WEBHOOK_SECRET`; set `SANITY_API_WRITE_TOKEN` (a Sanity API
      token with Editor access — needs a real Sanity project first, see
      above) so the webhook can actually record `order` documents —
      without it the webhook still verifies/processes events but only
      logs a warning instead of writing; optionally set
      `SHOP_ORDER_FROM_EMAIL` (reuses `RESEND_API_KEY` from the contact
      form vars above) for order confirmation emails — without it,
      checkout still completes and the order still records, only the
      email is skipped. Create each product's Price in the Stripe
      Dashboard first, then create a matching `product` document in the
      Studio with that `stripePriceId` — there's no import/sync tooling,
      this is a manual one-to-one link by design (see CLAUDE.md's
      price-drift note). The codebase has never processed a real charge;
      test the full flow with Stripe test-mode card numbers before
      considering this done.

- [ ] `USE_MOCK_CONTENT` — confirmed unset in Vercel (`vercel env ls`
      shows nothing for it); keep it that way. (It _is_ set to `true` in
      the local `.env.local` some sessions use for visual review — that
      file is gitignored and never reaches Vercel.)
- [ ] HSTS preload submission (hstspreload.org) — hold until the legacy
      domains above are live too, so the whole preload set resolves
      correctly first.
