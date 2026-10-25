import { DEFAULT_AI_CRAWLERS, type CrawlerPolicy, type SiteIdentity } from "seo-core";

// TEMPLATE: replace every value below at Site Activation (Layer 2).
export const SITE_URL = "https://example.com";
export const SITE_NAME = "Site Name";
export const SITE_TAGLINE = "Primary positioning phrase"; // used in homepage <title>
/** Official brand profiles (LinkedIn company page, Crunchbase, X…). The audit warns while empty. */
export const SAME_AS: string[] = [];
/** Organization logo: PNG/JPEG/WebP in public/, at least 112×112px (the audit fails SVG and favicons). */
export const LOGO_PATH = "/logo.png";
/** Open Graph image for pages without their own (1200×675, matches BaseLayout's og:image size). */
export const DEFAULT_OG_IMAGE = "/og-default.png";
export const ARTICLES_BASE = "articles";          // URL segment; changing later requires redirects
/**
 * Google Analytics 4 Measurement ID ("G-XXXXXXXXXX"). Public, so it can live in
 * the repo (TNV can set it). PUBLIC_ANALYTICS_ID in Vercel overrides it. Empty = no tag.
 */
export const GA4_MEASUREMENT_ID = "";
/** Meta descriptions of pages the template builds itself (articles index, team index, 404). */
export const ARTICLES_DESCRIPTION =
  "Browse every published article: practical guides on technical SEO, content strategy and the operating systems behind them, kept current and reviewed.";
export const TEAM_DESCRIPTION =
  "Meet the people behind this site: the operators and editors who write, review and maintain every guide, and the experience each one brings to the work.";
export const NOT_FOUND_DESCRIPTION =
  "The page you requested is not on this site. Use the navigation to return home or browse articles.";
/** seo-core's default list (CCBot allowed on purpose). Override single entries here if a site must differ. */
export const AI_CRAWLERS: Record<string, CrawlerPolicy> = { ...DEFAULT_AI_CRAWLERS };

export const SITE_IDENTITY: SiteIdentity = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  logo: LOGO_PATH,
  sameAs: SAME_AS,
};

export const NAV: { label: string; href: string }[] = [
  { label: "About", href: "/about/" },
  { label: "Services", href: "/services/" },
  { label: "Articles", href: `/${ARTICLES_BASE}/` },
  { label: "Contact", href: "/contact/" },
];

export const HEADER_CTA = { label: "Contact", href: "/contact/" };

export const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "Privacy", href: "/privacy/" },
  { label: "Terms", href: "/terms/" },
];

if (!NAV.some((item) => item.href === `/${ARTICLES_BASE}/`)) {
  throw new Error("Articles must stay in NAV");
}
