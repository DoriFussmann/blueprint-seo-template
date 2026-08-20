import { DEFAULT_AUTHOR } from "../../site/src/config/site.ts";

/** CMS intake mirror of the Astro articles schema. Author null is resolved to DEFAULT_AUTHOR before write. */
export const INTAKE_DEFAULTS = {
  author: DEFAULT_AUTHOR,
  draft: false,
  robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  schemaType: "Article",
  locale: "en_US",
  twitterCard: "summary_large_image",
  internalLinks: [] as { slug: string; anchor: string }[],
  externalLinks: [] as { label: string; url: string; addedAt: string }[],
  faqs: [] as { question: string; answer: string }[],
};
