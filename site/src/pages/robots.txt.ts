import type { APIRoute } from "astro";
import { AI_CRAWLERS, SITE_URL } from "../config/site";
import { abs } from "../lib/url";

export const GET: APIRoute = () => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
  ];
  for (const [agent, policy] of Object.entries(AI_CRAWLERS)) {
    lines.push(`User-agent: ${agent}`);
    lines.push(policy === "deny" ? "Disallow: /" : "Allow: /");
    lines.push("");
  }
  lines.push(`Sitemap: ${abs("/sitemap-index.xml")}`);
  lines.push("");
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
