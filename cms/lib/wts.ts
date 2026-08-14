import { WTS_END, WTS_START } from "./constants.ts";

export function extractWts(body: string): {
  paragraph: string;
  startCount: number;
  endCount: number;
  headingPresent: boolean;
} {
  const text = String(body || "");
  const startCount = count(text, WTS_START);
  const endCount = count(text, WTS_END);
  const headingPresent = /^##\s+Where Things Stand\s*$/m.test(text);
  if (startCount !== 1 || endCount !== 1) {
    return { paragraph: "", startCount, endCount, headingPresent };
  }
  const start = text.indexOf(WTS_START);
  const end = text.indexOf(WTS_END);
  if (start < 0 || end < 0 || end <= start) {
    return { paragraph: "", startCount, endCount, headingPresent };
  }
  const paragraph = text.slice(start + WTS_START.length, end).trim();
  return { paragraph, startCount, endCount, headingPresent };
}

export function replaceWtsParagraph(body: string, next: string): string {
  const { startCount, endCount } = extractWts(body);
  if (startCount !== 1 || endCount !== 1) {
    throw new Error("Where Things Stand markers must appear exactly once each");
  }
  const start = body.indexOf(WTS_START);
  const end = body.indexOf(WTS_END);
  return (
    body.slice(0, start + WTS_START.length) +
    "\n" +
    String(next || "").trim() +
    "\n" +
    body.slice(end)
  );
}

function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let from = 0;
  while (true) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) break;
    n += 1;
    from = i + needle.length;
  }
  return n;
}
