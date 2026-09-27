// TEMPLATE: replace every value below at Site Activation (Layer 2).
export const SITE_URL = "https://example.com";
export const SITE_NAME = "Site Name";
export const SITE_TAGLINE = "Primary positioning phrase"; // used in homepage <title>
export const SAME_AS: string[] = [];
export const ARTICLES_BASE = "articles";          // URL segment; changing later requires redirects
export const GOOGLE_SITE_VERIFICATION = "";       // rendered as <meta> only when non-empty
export const DEFAULT_AUTHOR = "dori-fussmann";
export const AI_CRAWLERS: Record<string, "allow" | "deny"> = {
  GPTBot: "allow", ClaudeBot: "allow", "Claude-Web": "allow",
  PerplexityBot: "allow", "Google-Extended": "allow", CCBot: "deny",
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
