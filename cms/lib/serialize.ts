function yamlEscape(value: string): string {
  const text = String(value ?? "");
  if (
    text === "" ||
    /[:#{}[\],&*?|>!%@`]/.test(text) ||
    /^\s|\s$/.test(text) ||
    text.includes("\n") ||
    text.includes('"') ||
    /^(true|false|null|yes|no|on|off)$/i.test(text)
  ) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return text;
}

export function serializeArticleMarkdown(
  data: Record<string, unknown>,
  body: string
): string {
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const keywords = Array.isArray(data.keywords) ? data.keywords : [];
  const faqs = Array.isArray(data.faqs) ? data.faqs : [];
  const internalLinks = Array.isArray(data.internalLinks) ? data.internalLinks : [];
  const externalLinks = Array.isArray(data.externalLinks) ? data.externalLinks : [];
  const supportingKeyword = String(data.supportingKeyword || "").trim();
  const lines = ["---"];

  const scalar = (key: string, fallback = "") => {
    const value = data[key];
    if (value == null || value === "") {
      if (fallback !== "") lines.push(`${key}: ${yamlEscape(fallback)}`);
      return;
    }
    if (typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
      return;
    }
    lines.push(`${key}: ${yamlEscape(String(value))}`);
  };

  scalar("title");
  scalar("description");
  scalar("slug");
  scalar("date");
  if (data.updatedDate) scalar("updatedDate");
  else if (data.date) lines.push(`updatedDate: ${yamlEscape(String(data.date))}`);
  scalar("author");
  scalar("category");
  if (data.pillarKeyword) scalar("pillarKeyword");
  if (supportingKeyword) {
    lines.push(`supportingKeyword: ${yamlEscape(supportingKeyword)}`);
  }
  if (data.articleType) scalar("articleType");
  if (data.targetKeyword) scalar("targetKeyword");
  if (data.h1 && String(data.h1) !== String(data.title)) scalar("h1");

  lines.push("tags:");
  for (const tag of tags) lines.push(`  - ${yamlEscape(String(tag))}`);

  scalar("image");
  scalar("imageAlt");
  if (data.image2) {
    scalar("image2");
    if (data.image2Alt) scalar("image2Alt");
  }
  if (data.image3) {
    scalar("image3");
    if (data.image3Alt) scalar("image3Alt");
  }

  if (keywords.length) {
    lines.push("keywords:");
    for (const kw of keywords) lines.push(`  - ${yamlEscape(String(kw))}`);
  }

  scalar("robots", "index, follow");
  scalar("schemaType", "BlogPosting");
  scalar("locale", "en-US");
  scalar("twitterCard", "summary_large_image");
  lines.push(`draft: ${data.draft ? "true" : "false"}`);

  if (data.canonical) scalar("canonical");
  if (data.ogTitle && data.ogTitle !== data.title) scalar("ogTitle");
  if (data.ogDescription && data.ogDescription !== data.description) {
    scalar("ogDescription");
  }
  if (data.ogImage) scalar("ogImage");

  if (internalLinks.length === 0) {
    lines.push("internalLinks: []");
  } else {
    lines.push("internalLinks:");
    for (const link of internalLinks) {
      lines.push(`  - label: ${yamlEscape(String(link.label || ""))}`);
      lines.push(`    url: ${yamlEscape(String(link.url || ""))}`);
    }
  }

  if (externalLinks.length === 0) {
    lines.push("externalLinks: []");
  } else {
    lines.push("externalLinks:");
    for (const link of externalLinks) {
      lines.push(`  - label: ${yamlEscape(String(link.label || ""))}`);
      lines.push(`    url: ${yamlEscape(String(link.url || ""))}`);
    }
  }

  if (faqs.length === 0) {
    lines.push("faqs: []");
  } else {
    lines.push("faqs:");
    for (const faq of faqs) {
      lines.push(`  - question: ${yamlEscape(String(faq.question || ""))}`);
      lines.push(`    answer: ${yamlEscape(String(faq.answer || ""))}`);
    }
  }

  lines.push("---", "");
  lines.push(String(body || "").replace(/^\uFEFF/, "").replace(/\s+$/, ""), "");
  return lines.join("\n");
}

export function serializeTeamMarkdown(
  data: Record<string, unknown>,
  body = ""
): string {
  const sameAs = Array.isArray(data.sameAs) ? data.sameAs : [];
  const lines = ["---"];
  const scalar = (key: string) => {
    if (data[key] == null || data[key] === "") return;
    lines.push(`${key}: ${yamlEscape(String(data[key]))}`);
  };
  scalar("name");
  scalar("slug");
  scalar("role");
  scalar("bio");
  if (data.credentials) scalar("credentials");
  scalar("photo");
  if (sameAs.length === 0) lines.push("sameAs: []");
  lines.push("---", "");
  if (body.trim()) lines.push(body.trim(), "");
  return lines.join("\n");
}

export { yamlEscape };
