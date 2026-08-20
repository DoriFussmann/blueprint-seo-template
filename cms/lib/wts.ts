import { WTS_END, WTS_START } from "./constants";

export function wtsCounts(body: string) {
  const start = [...body.matchAll(/<!--\s*WHERE-THINGS-STAND:START\s*-->/g)].length;
  const end = [...body.matchAll(/<!--\s*WHERE-THINGS-STAND:END\s*-->/g)].length;
  const heading = [...body.matchAll(/^## Where Things Stand\s*$/gm)].length;
  return { start, end, heading };
}

export function replaceWtsParagraph(body: string, paragraph: string): string {
  const re = /<!--\s*WHERE-THINGS-STAND:START\s*-->[\s\S]*?<!--\s*WHERE-THINGS-STAND:END\s*-->/;
  if (!re.test(body)) {
    throw new Error("Where Things Stand markers are missing");
  }
  return body.replace(re, `${WTS_START}\n${paragraph.trim()}\n${WTS_END}`);
}
