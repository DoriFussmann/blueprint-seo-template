export const MAX_EXTERNAL_LINKS = 5;
export const MIN_EXTERNAL_LINKS = 3;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const NO_VOLUME_RE = /\s*\(no volume data\)\s*$/i;
export const WTS_START = "<!-- WHERE-THINGS-STAND:START -->";
export const WTS_END = "<!-- WHERE-THINGS-STAND:END -->";
export const INTERNAL_START = "<!-- CMS-INTERNAL:START -->";
export const INTERNAL_END = "<!-- CMS-INTERNAL:END -->";
export const EXTERNAL_START = "<!-- CMS-EXTERNAL:START -->";
export const EXTERNAL_END = "<!-- CMS-EXTERNAL:END -->";
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const FRONTMATTER_KEY_ORDER = [
  "title",
  "description",
  "slug",
  "date",
  "updatedDate",
  "author",
  "category",
  "pillarKeyword",
  "supportingKeyword",
  "articleType",
  "targetKeyword",
  "tags",
  "image",
  "imageAlt",
  "image2",
  "image3",
  "keywords",
  "draft",
  "robots",
  "schemaType",
  "locale",
  "twitterCard",
  "internalLinks",
  "externalLinks",
  "faqs",
  "published_url",
] as const;
