import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/components/ui/SkipLink";
import { Header } from "@/components/patterns/Header";
import { Footer } from "@/components/patterns/Footer";
import { ConsentBanner } from "@/components/patterns/ConsentBanner";
import { PreviewBanner } from "@/components/patterns/PreviewBanner";
import { getSiteSettings } from "@/lib/sanity/queries";
import { resolveLink, resolveLinks } from "@/lib/links";
import { useMockContent } from "@/lib/sanity/env";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_FOOTER_NOTE,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_SITE_TITLE,
} from "@/lib/siteDefaults";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: DEFAULT_SITE_TITLE,
    template: `%s | ${DEFAULT_SITE_TITLE}`,
  },
  description: DEFAULT_DESCRIPTION,
  // Belt-and-suspenders: if USE_MOCK_CONTENT is ever left on somewhere it
  // shouldn't be, search engines still won't index the placeholder copy.
  // Individual pages can still opt into their own noindex on top of this.
  robots: useMockContent
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Site-wide chrome falls back to sensible defaults when Sanity isn't
  // configured (true everywhere right now) — see lib/siteDefaults.ts for
  // why that's a different rule from page-content null-handling.
  const siteSettings = await getSiteSettings();

  const siteTitle = siteSettings?.siteTitle || DEFAULT_SITE_TITLE;
  const primaryNav = siteSettings
    ? resolveLinks(siteSettings.primaryNav)
    : DEFAULT_PRIMARY_NAV;
  const footerNav = siteSettings ? resolveLinks(siteSettings.footerNav) : [];
  const socialLinks = siteSettings
    ? resolveLinks(siteSettings.socialLinks)
    : [];
  const footerNote = siteSettings?.footerNote || DEFAULT_FOOTER_NOTE;
  const consentPolicyLink = siteSettings?.consentBanner?.policyLink
    ? resolveLink(siteSettings.consentBanner.policyLink)
    : null;
  const consentEnabled = siteSettings?.consentBanner?.enabled ?? true;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {useMockContent && <PreviewBanner />}
        <SkipLink />
        <Header siteTitle={siteTitle} nav={primaryNav} />
        <main id="main-content">{children}</main>
        <Footer
          siteTitle={siteTitle}
          nav={footerNav}
          socialLinks={socialLinks}
          note={footerNote}
        />
        {consentEnabled && (
          <ConsentBanner
            message={siteSettings?.consentBanner?.message}
            policyHref={consentPolicyLink?.href}
            policyLabel={consentPolicyLink?.label}
          />
        )}
      </body>
    </html>
  );
}
