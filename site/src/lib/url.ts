import { SITE_URL } from "../config/site";

const FILE_ENDPOINT_RE = /\.(txt|xml)$/i;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

/**
 * Join SITE_URL + path. Trailing slash on every page URL.
 * File endpoints (robots.txt, rss.xml, sitemap-index.xml) keep no trailing slash.
 * Absolute http(s) URLs are returned as-is (canonical override rule).
 */
export function absoluteUrl(path: string): string {
  const base = stripTrailingSlashes(SITE_URL);
  if (!path || path === "/") return `${base}/`;
  if (/^https?:\/\//i.test(path)) return path;

  const pathname = ensureLeadingSlash(path);
  if (FILE_ENDPOINT_RE.test(pathname)) {
    return `${base}${pathname}`;
  }
  return `${base}${stripTrailingSlashes(pathname)}/`;
}

/** In-site href: trailing slash except file endpoints. */
export function pagePath(path: string): string {
  if (!path || path === "/") return "/";
  const pathname = ensureLeadingSlash(path);
  if (FILE_ENDPOINT_RE.test(pathname)) return pathname;
  return `${stripTrailingSlashes(pathname)}/`;
}

export function siteOrigin(): string {
  try {
    return new URL(SITE_URL).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "example.com";
  }
}
