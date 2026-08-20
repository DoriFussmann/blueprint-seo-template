import { SITE_NAME, SITE_URL, SAME_AS } from "../config/site";
import { abs } from "./url";

export function orgNode() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL.replace(/\/+$/, "")}/favicon.svg`,
    sameAs: SAME_AS,
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}#org` },
  };
}

export function breadcrumbNode(
  crumbs: { name: string; href: string }[],
) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${crumbs[crumbs.length - 1]?.href ?? SITE_URL}#breadcrumb`,
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.href,
    })),
  };
}

export function personNode(opts: {
  slug: string;
  name: string;
  role: string;
  description: string;
  image: string;
  sameAs: string[];
  knowsAbout: string[];
}) {
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/team/${opts.slug}/#person`,
    name: opts.name,
    jobTitle: opts.role,
    description: opts.description,
    image: opts.image,
    sameAs: opts.sameAs,
    knowsAbout: opts.knowsAbout,
    url: abs(`/team/${opts.slug}/`),
  };
}

export function faqPageNode(faqs: { question: string; answer: string }[], pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
