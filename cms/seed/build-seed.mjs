import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import JSZip from "jszip";

const root = path.dirname(fileURLToPath(import.meta.url));

function assertLen(label, value, min, max) {
  const n = value.length;
  if (n < min || n > max) {
    throw new Error(`${label} is ${n} chars (need ${min}-${max}): ${value}`);
  }
}

const articles = [
  {
    slug: "technical-seo-foundations",
    title: "Technical SEO Foundations for Durable Search Visibility",
    description:
      "A complete technical SEO hub covering crawlability, indexation, site architecture, and the measurement loop that keeps pages eligible to rank.",
    articleType: "comprehensive",
    pillarKeyword: "technical seo",
    targetKeyword: "technical seo",
    category: "technical seo",
    imageAlt: "Abstract diagram of crawl, index, and render for technical SEO",
    h2s: ["Crawl and indexation", "Architecture and internal links", "Measurement loop"],
  },
  {
    slug: "core-web-vitals-complete-guide",
    title: "Core Web Vitals Guide for Technical SEO and Real-User Data",
    description:
      "The supporting comprehensive guide to Core Web Vitals: what LCP, INP, and CLS measure, how to diagnose field data, and how to prioritize fixes.",
    articleType: "comprehensive",
    pillarKeyword: "technical seo",
    supportingKeyword: "core web vitals",
    targetKeyword: "core web vitals",
    category: "technical seo",
    imageAlt: "Scorecard illustration of LCP, INP, and CLS vitals",
    h2s: ["What the vitals measure", "Field versus lab data", "Fix order that holds"],
  },
  {
    slug: "improve-core-web-vitals-howto",
    title: "How to Improve Core Web Vitals With a Repeatable Process",
    description:
      "A practical how-to for improving Core Web Vitals: capture field data, isolate the worst template, ship one fix at a time, then re-measure results.",
    articleType: "howto",
    pillarKeyword: "technical seo",
    supportingKeyword: "core web vitals",
    targetKeyword: "improve core web vitals",
    category: "technical seo",
    imageAlt: "Checklist for diagnosing and fixing Core Web Vitals issues",
    h2s: ["Capture the real user data", "Isolate the template", "Ship and re-measure"],
  },
];

function yamlEscape(value) {
  const text = String(value ?? "");
  if (
    text === "" ||
    /[:#{}[\],&*?|>!%@`]/.test(text) ||
    /^\s|\s$/.test(text) ||
    /^(true|false|null|yes|no|on|off)$/i.test(text)
  ) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function markdown(article) {
  assertLen("title " + article.slug, article.title, 55, 60);
  assertLen("description " + article.slug, article.description, 140, 160);
  const body = [
    `This seed article exists to prove the CMS batch-upload and internal-link pipeline. Replace it at Site Activation.`,
    "",
    `## ${article.h2s[0]}`,
    "",
    `Keep the primary topic on ${article.targetKeyword}. Explain the problem in plain language, then the mechanism, then the check.`,
    "",
    `## ${article.h2s[1]}`,
    "",
    `Use the same vocabulary a practitioner would search for. Do not invent a client brand. Cite the measurement method before the tactic.`,
    "",
    `## ${article.h2s[2]}`,
    "",
    `Close with a verification step so the reader can tell whether the change worked.`,
    "",
    `## Where Things Stand`,
    "<!-- WHERE-THINGS-STAND:START -->",
    "As of this template seed, Core Web Vitals remain a ranking consideration and a user-experience diagnostic. Teams should treat field data as the source of truth and lab data as a debugging aid, not the other way around.",
    "<!-- WHERE-THINGS-STAND:END -->",
    "",
  ].join("\n");

  const supporting = article.supportingKeyword
    ? `supportingKeyword: ${yamlEscape(article.supportingKeyword)}\n`
    : "";

  return `---
title: ${yamlEscape(article.title)}
description: ${yamlEscape(article.description)}
slug: ${article.slug}
date: 2026-08-14
updatedDate: 2026-08-14
author: null
category: ${yamlEscape(article.category)}
pillarKeyword: ${yamlEscape(article.pillarKeyword)}
${supporting}articleType: ${article.articleType}
targetKeyword: ${yamlEscape(article.targetKeyword)}
tags:
  - technical-seo
  - core-web-vitals
  - indexation
  - performance
imageAlt: ${yamlEscape(article.imageAlt)}
keywords:
  - ${yamlEscape(article.pillarKeyword)}
draft: false
internalLinks: []
externalLinks: []
faqs:
  - question: ${yamlEscape("What is this seed article for?")}
    answer: ${yamlEscape("It proves the CMS batch-upload and Connect flows in the template repo.")}
  - question: ${yamlEscape("Should this ship on a real domain?")}
    answer: ${yamlEscape("No. Set draft true after verification and replace it at Site Activation.")}
---

${body}`;
}

const zip = new JSZip();
for (const article of articles) {
  const md = markdown(article);
  fs.writeFileSync(path.join(root, `${article.slug}.md`), md);
  const png = await sharp({
    create: {
      width: 1200,
      height: 675,
      channels: 3,
      background: { r: 31, g: 41, b: 55 },
    },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(root, `${article.slug}.png`), png);
  zip.file(`${article.slug}.md`, md);
  zip.file(`${article.slug}.png`, png);
}

const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(path.join(root, "technical-seo-drafts.zip"), zipBuf);
console.log("wrote seed zip", path.join(root, "technical-seo-drafts.zip"));
