import { visit } from "unist-util-visit";

export const WTS_START = "<!-- WHERE-THINGS-STAND:START -->";
export const WTS_END = "<!-- WHERE-THINGS-STAND:END -->";

function isHtmlComment(value: string): boolean {
  return /<!--[\s\S]*?-->/.test(value);
}

/**
 * Keep HTML comments (especially WTS markers) in the mdast tree as `html` nodes
 * so rehype can emit them into the built page.
 */
export function remarkPreserveHtmlComments() {
  return (tree: any, file: any) => {
    const src = String(file?.value ?? "");
    let foundStart = false;
    let foundEnd = false;

    visit(tree, "html", (node: { value?: string }) => {
      const value = String(node.value || "");
      if (value.includes("WHERE-THINGS-STAND:START")) foundStart = true;
      if (value.includes("WHERE-THINGS-STAND:END")) foundEnd = true;
    });

    if (src.includes("WHERE-THINGS-STAND:START") && !foundStart) {
      injectMarkers(tree, src);
      return;
    }

    if (!foundStart && !foundEnd) {
      visit(tree, "html", (node: { value?: string }) => {
        if (node.value && isHtmlComment(node.value)) {
          node.value = node.value;
        }
      });
    }
  };
}

function injectMarkers(tree: any, src: string) {
  const children = Array.isArray(tree.children) ? tree.children : [];
  const headingIndex = children.findIndex(
    (node: any) =>
      node.type === "heading" &&
      Array.isArray(node.children) &&
      node.children.some((c: any) =>
        String(c.value || "")
          .toLowerCase()
          .includes("where things stand")
      )
  );
  if (headingIndex < 0) return;

  const afterHeading = headingIndex + 1;
  const startNode = { type: "html", value: WTS_START };
  const endNode = { type: "html", value: WTS_END };

  const alreadyStart = children[afterHeading]?.type === "html";
  if (!alreadyStart) {
    children.splice(afterHeading, 0, startNode);
  }

  const srcHasEnd = src.includes("WHERE-THINGS-STAND:END");
  if (!srcHasEnd) return;

  let endInjected = children.some(
    (node: any) =>
      node.type === "html" &&
      String(node.value || "").includes("WHERE-THINGS-STAND:END")
  );
  if (endInjected) return;

  let depth = 0;
  let insertAt = children.length;
  for (let i = afterHeading + 1; i < children.length; i += 1) {
    const node = children[i];
    if (node.type === "heading" && node.depth <= 2) {
      insertAt = i;
      break;
    }
    depth += 1;
    if (depth >= 3) {
      insertAt = i + 1;
      break;
    }
  }
  children.splice(insertAt, 0, endNode);
}

/**
 * Convert mdast/hast comment or html-comment nodes into raw HTML so
 * rehype-stringify emits the literal comment markers.
 */
export function rehypePreserveHtmlComments() {
  return (tree: any) => {
    visit(tree, (node: any, index: number | undefined, parent: any) => {
      if (typeof index !== "number" || !parent) return;
      if (node.type === "comment") {
        parent.children[index] = {
          type: "raw",
          value: `<!--${node.value}-->`,
        };
        return;
      }
      if (
        (node.type === "raw" || node.type === "html") &&
        typeof node.value === "string" &&
        isHtmlComment(node.value)
      ) {
        parent.children[index] = {
          type: "raw",
          value: node.value,
        };
      }
    });
  };
}
