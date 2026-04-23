import { parse as parseHtml, HTMLElement, Node as HtmlNode, NodeType } from "node-html-parser";
import safeParser from "postcss-safe-parser";
import type {
  ComponentNode,
  FigmaNode,
  FrameNode,
  RectangleNode,
  TextNode,
  VectorNode,
  Warning,
} from "../types/figma.js";
import { applyStyleToNode, cssToFigma, parseDeclarationBlock } from "./cssToFigma.js";

const TEXT_TAGS = new Set(["p", "span", "a", "strong", "em", "b", "i", "small", "label", "li", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6"]);
const FRAME_TAGS = new Set([
  "div", "section", "main", "nav", "header", "footer", "article", "aside",
  "ul", "ol", "form", "figure", "table", "tr",
]);

const TAG_DEFAULT_FONT_SIZE: Record<string, number> = {
  h1: 32, h2: 24, h3: 20, h4: 16, h5: 14, h6: 12, p: 16, body: 16,
};

export type ExternalStyleRule = {
  selector: string;
  decls: Record<string, string>;
};

export function parseStylesheet(css: string): ExternalStyleRule[] {
  const rules: ExternalStyleRule[] = [];
  try {
    const root = safeParser(css);
    root.walkRules((rule) => {
      const decls: Record<string, string> = {};
      rule.walkDecls((d) => {
        decls[d.prop.trim().toLowerCase()] = d.value.trim();
      });
      for (const selector of rule.selectors) {
        rules.push({ selector: selector.trim(), decls });
      }
    });
  } catch {
    // best-effort; return whatever we have
  }
  return rules;
}

// Map each selector to the set of elements it matches by running the selector
// once against the parsed HTML root. We then look up per element.
export function buildStylesheetMatchIndex(
  root: HTMLElement,
  rules: ExternalStyleRule[]
): WeakMap<HTMLElement, Record<string, string>> {
  const index = new WeakMap<HTMLElement, Record<string, string>>();
  for (const rule of rules) {
    let matched: HTMLElement[] = [];
    try {
      matched = root.querySelectorAll(rule.selector);
    } catch {
      continue;
    }
    for (const el of matched) {
      const existing = index.get(el) ?? {};
      Object.assign(existing, rule.decls);
      index.set(el, existing);
    }
  }
  return index;
}

export function convertHtmlToFigma(
  html: string,
  css?: string,
  options: { rootName?: string } = {}
): { root: FigmaNode; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const root = parseHtml(html, {
    lowerCaseTagName: true,
    voidTag: { closingSlash: true },
  });
  const stylesheet = css ? parseStylesheet(css) : [];
  const matchIndex = buildStylesheetMatchIndex(root, stylesheet);

  // Find a single content root: prefer <body>, else the parsed root's first element child.
  const body = root.querySelector("body") ?? root;
  const rootFrame: FrameNode = {
    type: "FRAME",
    name: options.rootName ?? "Root",
    layoutMode: "VERTICAL",
    itemSpacing: 0,
    children: [],
  };

  for (const child of body.childNodes) {
    const node = walk(child, matchIndex, warnings);
    if (node) rootFrame.children!.push(node);
  }

  return { root: rootFrame, warnings };
}

function walk(
  node: HtmlNode,
  matchIndex: WeakMap<HTMLElement, Record<string, string>>,
  warnings: Warning[]
): FigmaNode | null {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.rawText.replace(/\s+/g, " ").trim();
    if (!text) return null;
    return textNodeFromString(text);
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (!tag) return null;
  if (tag === "script" || tag === "style" || tag === "noscript" || tag === "meta" || tag === "link") {
    return null;
  }

  if (tag === "svg") {
    return buildSvgNode(el);
  }
  if (tag === "img") {
    return buildImageNode(el);
  }
  if (tag === "button") {
    return buildButtonNode(el, matchIndex, warnings);
  }

  const decls = mergeDeclsForElement(el, matchIndex);

  if (TEXT_TAGS.has(tag) && !hasBlockChildren(el)) {
    const content = extractText(el);
    if (!content && el.childNodes.length === 0) return null;
    const tn = textNodeFromString(content || "", tag);
    const mapped = cssToFigma(decls);
    warnings.push(...mapped.warnings);
    applyStyleToNode(tn, mapped.style);
    return tn;
  }

  if (FRAME_TAGS.has(tag) || TEXT_TAGS.has(tag)) {
    return buildFrameNode(el, decls, matchIndex, warnings, tag);
  }

  // Fallback: treat unknown elements as a frame.
  return buildFrameNode(el, decls, matchIndex, warnings, tag);
}

function hasBlockChildren(el: HTMLElement): boolean {
  for (const child of el.childNodes) {
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const t = (child as HTMLElement).tagName?.toLowerCase();
    if (t && (FRAME_TAGS.has(t) || t === "img" || t === "button" || t === "svg")) return true;
  }
  return false;
}

function extractText(el: HTMLElement): string {
  return el.text.replace(/\s+/g, " ").trim();
}

function mergeDeclsForElement(
  el: HTMLElement,
  matchIndex: WeakMap<HTMLElement, Record<string, string>>
): Record<string, string> {
  const fromRules = matchIndex.get(el) ?? {};
  const inline = el.getAttribute("style");
  const fromInline = inline ? parseDeclarationBlock(inline) : {};
  return { ...fromRules, ...fromInline };
}

function buildFrameNode(
  el: HTMLElement,
  decls: Record<string, string>,
  matchIndex: WeakMap<HTMLElement, Record<string, string>>,
  warnings: Warning[],
  tag: string
): FrameNode {
  const frame: FrameNode = {
    type: "FRAME",
    name: tag,
    layoutMode: decls["display"]?.includes("flex") ? "HORIZONTAL" : "VERTICAL",
    children: [],
  };
  const mapped = cssToFigma(decls);
  warnings.push(...mapped.warnings);
  applyStyleToNode(frame, mapped.style);

  for (const child of el.childNodes) {
    const childNode = walk(child, matchIndex, warnings);
    if (childNode) frame.children!.push(childNode);
  }
  return frame;
}

function buildButtonNode(
  el: HTMLElement,
  matchIndex: WeakMap<HTMLElement, Record<string, string>>,
  warnings: Warning[]
): ComponentNode {
  const decls = mergeDeclsForElement(el, matchIndex);
  const comp: ComponentNode = {
    type: "COMPONENT",
    name: "button",
    layoutMode: "HORIZONTAL",
    children: [],
  };
  const mapped = cssToFigma(decls);
  warnings.push(...mapped.warnings);
  applyStyleToNode(comp, mapped.style);

  for (const child of el.childNodes) {
    const childNode = walk(child, matchIndex, warnings);
    if (childNode) comp.children!.push(childNode);
  }
  // If no children, fall back to the text content.
  if (!comp.children!.length) {
    const t = extractText(el);
    if (t) comp.children!.push(textNodeFromString(t));
  }
  return comp;
}

function buildImageNode(el: HTMLElement): RectangleNode {
  const src = el.getAttribute("src") ?? "";
  const width = parseInt(el.getAttribute("width") ?? "", 10);
  const height = parseInt(el.getAttribute("height") ?? "", 10);
  const node: RectangleNode = {
    type: "RECTANGLE",
    name: el.getAttribute("alt") || "image",
    fills: [{ type: "IMAGE", imageUrl: src, scaleMode: "FILL" }],
  };
  if (!Number.isNaN(width)) node.width = width;
  if (!Number.isNaN(height)) node.height = height;
  return node;
}

function buildSvgNode(el: HTMLElement): VectorNode {
  return {
    type: "VECTOR",
    name: "svg",
    svgSource: el.toString(),
  };
}

function textNodeFromString(characters: string, tag?: string): TextNode {
  const fontSize = tag ? TAG_DEFAULT_FONT_SIZE[tag] ?? 16 : 16;
  const fontWeight = tag && /^h[1-6]$/.test(tag) ? 700 : 400;
  return {
    type: "TEXT",
    name: tag ?? "text",
    characters,
    style: {
      fontFamily: "Inter",
      fontSize,
      fontWeight,
    },
  };
}
