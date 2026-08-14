/**
 * CMS intake schema. Field-for-field with site/src/content.config.ts, except
 * `author` may be null/absent (upstream always writes `author: null`). That
 * case is reported as a missing required field — never written to the site.
 */

export const ARTICLE_TYPES = [
  "comprehensive",
  "howto",
  "comparison",
  "faq",
  "flex",
] as const;

export type ArticleType = (typeof ARTICLE_TYPES)[number];

export interface LinkItem {
  label: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ArticleFrontmatter {
  title: string;
  description: string;
  slug: string;
  date: string;
  author: string | null;
  category: string;
  tags: string[];
  image?: string | null;
  imageAlt: string;
  robots?: string;
  schemaType?: string;
  locale?: string;
  twitterCard?: string;
  draft?: boolean;
  h1?: string;
  pillarKeyword?: string;
  supportingKeyword?: string;
  articleType?: ArticleType | string;
  targetKeyword?: string;
  updatedDate?: string;
  keywords?: string[];
  canonical?: string;
  image2?: string | null;
  image2Alt?: string;
  image3?: string | null;
  image3Alt?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  internalLinks?: LinkItem[];
  externalLinks?: LinkItem[];
  faqs?: FaqItem[];
}

export interface TeamFrontmatter {
  name: string;
  slug: string;
  role: string;
  bio: string;
  credentials?: string;
  photo?: string | null;
  sameAs?: string[];
}

export interface ServiceFrontmatter {
  title: string;
  slug: string;
  summary: string;
  order: number;
}

export function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function asLinks(value: unknown): LinkItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      label: asString(item?.label),
      url: asString(item?.url),
    }))
    .filter((item) => item.label || item.url);
}

export function asFaqs(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      question: asString(item?.question),
      answer: asString(item?.answer),
    }))
    .filter((item) => item.question || item.answer);
}

export function isoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = asString(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return text;
}

/** Parse intake frontmatter. Never throws on null author. */
export function normalizeIntake(raw: Record<string, unknown>): ArticleFrontmatter {
  const authorRaw = raw.author;
  const author =
    authorRaw == null || asString(authorRaw) === "" || asString(authorRaw) === "null"
      ? null
      : asString(authorRaw);

  return {
    title: asString(raw.title),
    description: asString(raw.description),
    slug: asString(raw.slug),
    date: isoDate(raw.date),
    author,
    category: asString(raw.category),
    tags: asStringArray(raw.tags),
    image: raw.image == null ? null : asString(raw.image) || null,
    imageAlt: asString(raw.imageAlt),
    robots: asString(raw.robots) || "index, follow",
    schemaType: asString(raw.schemaType) || "BlogPosting",
    locale: asString(raw.locale) || "en-US",
    twitterCard: asString(raw.twitterCard) || "summary_large_image",
    draft: raw.draft == null ? false : Boolean(raw.draft),
    h1: asString(raw.h1) || undefined,
    pillarKeyword: asString(raw.pillarKeyword) || undefined,
    supportingKeyword: asString(raw.supportingKeyword) || undefined,
    articleType: asString(raw.articleType) || undefined,
    targetKeyword: asString(raw.targetKeyword) || undefined,
    updatedDate: isoDate(raw.updatedDate) || undefined,
    keywords: asStringArray(raw.keywords),
    canonical: asString(raw.canonical) || undefined,
    image2: raw.image2 == null ? null : asString(raw.image2) || null,
    image2Alt: asString(raw.image2Alt) || undefined,
    image3: raw.image3 == null ? null : asString(raw.image3) || null,
    image3Alt: asString(raw.image3Alt) || undefined,
    ogTitle: asString(raw.ogTitle) || undefined,
    ogDescription: asString(raw.ogDescription) || undefined,
    ogImage: asString(raw.ogImage) || undefined,
    internalLinks: asLinks(raw.internalLinks),
    externalLinks: asLinks(raw.externalLinks),
    faqs: asFaqs(raw.faqs),
  };
}
