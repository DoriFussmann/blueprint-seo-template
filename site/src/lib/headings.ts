import GithubSlugger from "github-slugger";

export type Heading = { depth: number; text: string; id: string };

export function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  const lines = String(markdown || "").split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[#*_`]/g, "").trim();
    if (!text) continue;
    headings.push({
      depth: match[1].length,
      text,
      id: slugger.slug(text),
    });
  }
  return headings;
}
