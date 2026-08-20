import { FRONTMATTER_KEY_ORDER } from "./constants";

const DATE_KEYS = new Set(["date", "updatedDate", "addedAt"]);

function quote(value: string): string {
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function dumpValue(value: unknown, indent: number, key?: string): string {
  const pad = "  ".repeat(indent);
  if (value == null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (key && DATE_KEYS.has(key)) return quote(value);
    return quote(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (isPlainObject(item)) {
          const keys = Object.keys(item);
          const lines = keys.map((k, i) => {
            const dumped = dumpValue(item[k], indent + 2, k);
            const prefix = i === 0 ? `${pad}- ` : `${pad}  `;
            return `${prefix}${k}: ${dumped}`;
          });
          return lines.join("\n");
        }
        return `${pad}- ${dumpValue(item, indent + 1)}`;
      })
      .join("\n");
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return keys.map((k) => `${pad}${k}: ${dumpValue(value[k], indent + 1, k)}`).join("\n");
  }
  return quote(String(value));
}

export function serializeFrontmatter(data: Record<string, unknown>): string {
  const seen = new Set<string>();
  const lines = ["---"];
  const write = (key: string) => {
    if (!(key in data) || data[key] === undefined) return;
    seen.add(key);
    const value = data[key];
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      lines.push(`${key}:`);
      lines.push(dumpValue(value, 1, key));
    } else if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        lines.push(dumpValue(value, 1, key));
      }
    } else if (isPlainObject(value)) {
      lines.push(`${key}:`);
      lines.push(dumpValue(value, 1, key));
    } else {
      lines.push(`${key}: ${dumpValue(value, 0, key)}`);
    }
  };
  for (const key of FRONTMATTER_KEY_ORDER) write(key);
  for (const key of Object.keys(data).sort()) {
    if (!seen.has(key)) write(key);
  }
  lines.push("---");
  return lines.join("\n");
}

export function serializeMarkdown(data: Record<string, unknown>, body: string): string {
  const fm = serializeFrontmatter(data);
  const trimmed = body.replace(/^\uFEFF/, "").replace(/^\n+/, "").replace(/\s*$/, "");
  return `${fm}\n\n${trimmed}\n`;
}
