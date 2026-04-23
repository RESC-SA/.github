import { parse as parseHtml, HTMLElement, NodeType } from "node-html-parser";
import type { RGBA } from "../types/figma.js";
import { colorKey, parseColor } from "./colors.js";
import { parseDeclarationBlock } from "./cssToFigma.js";
import { parseStylesheet } from "./htmlToNodes.js";
import { parseLength } from "./units.js";

export type ColorToken = { name: string; value: RGBA; hex: string };
export type TypographyToken = {
  name: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
};
export type SpacingToken = { name: string; value: number };

export type TokenSet = {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
};

export type FigmaVariablesExport = {
  variables: {
    name: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING";
    valuesByMode: Record<string, unknown>;
  }[];
};

export function extractTokens(html: string, css?: string): TokenSet {
  const root = parseHtml(html, { lowerCaseTagName: true });
  const stylesheet = css ? parseStylesheet(css) : [];

  const colorCounts = new Map<string, { rgba: RGBA; count: number }>();
  const typographySigs = new Map<string, TypographyToken & { count: number }>();
  const spacingCounts = new Map<number, number>();

  function track(decls: Record<string, string>) {
    for (const [prop, value] of Object.entries(decls)) {
      if (prop === "color" || prop === "background-color" || prop === "background" || prop === "border-color") {
        const c = parseColor(value);
        if (c) bumpColor(colorCounts, c);
      }
      if (prop === "padding" || prop === "margin" || prop === "gap") {
        for (const p of value.split(/\s+/)) {
          const n = parseLength(p);
          if (n != null && n > 0) spacingCounts.set(n, (spacingCounts.get(n) ?? 0) + 1);
        }
      }
      if (prop === "font-size" || prop === "font-family" || prop === "font-weight" || prop === "line-height") {
        // typography aggregation happens per-declaration-set
      }
    }
    const sig = makeTypographySignature(decls);
    if (sig) {
      const key = JSON.stringify(sig);
      const existing = typographySigs.get(key);
      if (existing) existing.count++;
      else typographySigs.set(key, { ...sig, count: 1, name: "" });
    }
  }

  // From stylesheet
  for (const rule of stylesheet) track(rule.decls);

  // From inline styles
  walkElements(root, (el) => {
    const style = el.getAttribute("style");
    if (style) track(parseDeclarationBlock(style));
  });

  const colors: ColorToken[] = Array.from(colorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([k, v], i) => ({
      name: `color-${i + 1}`,
      value: v.rgba,
      hex: rgbaToHex(v.rgba),
    }));

  const typography: TypographyToken[] = Array.from(typographySigs.values())
    .sort((a, b) => b.count - a.count)
    .map(({ count, ...t }, i) => ({ ...t, name: `text-${i + 1}` }));

  const spacing: SpacingToken[] = Array.from(spacingCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([value], i) => ({ name: `space-${i + 1}`, value }));

  return { colors, typography, spacing };
}

export function toFigmaVariablesExport(tokens: TokenSet): FigmaVariablesExport {
  const variables: FigmaVariablesExport["variables"] = [];
  for (const c of tokens.colors) {
    variables.push({
      name: c.name,
      resolvedType: "COLOR",
      valuesByMode: { default: c.value },
    });
  }
  for (const s of tokens.spacing) {
    variables.push({
      name: s.name,
      resolvedType: "FLOAT",
      valuesByMode: { default: s.value },
    });
  }
  for (const t of tokens.typography) {
    variables.push({
      name: t.name + "/fontSize",
      resolvedType: "FLOAT",
      valuesByMode: { default: t.fontSize ?? 16 },
    });
    if (t.fontFamily) {
      variables.push({
        name: t.name + "/fontFamily",
        resolvedType: "STRING",
        valuesByMode: { default: t.fontFamily },
      });
    }
  }
  return { variables };
}

function bumpColor(map: Map<string, { rgba: RGBA; count: number }>, c: RGBA) {
  const k = colorKey(c);
  const hit = map.get(k);
  if (hit) hit.count++;
  else map.set(k, { rgba: c, count: 1 });
}

function makeTypographySignature(decls: Record<string, string>): TypographyToken | null {
  const fontFamily = decls["font-family"]?.split(",")[0]?.trim().replace(/['"]/g, "");
  const fontSize = parseLength(decls["font-size"]);
  const fontWeightRaw = decls["font-weight"];
  const fontWeight = fontWeightRaw ? parseInt(fontWeightRaw, 10) : undefined;
  const lineHeight = parseLength(decls["line-height"]);
  if (!fontFamily && fontSize == null && fontWeight == null && lineHeight == null) return null;
  const t: TypographyToken = { name: "" };
  if (fontFamily) t.fontFamily = fontFamily;
  if (fontSize != null) t.fontSize = fontSize;
  if (fontWeight != null && !Number.isNaN(fontWeight)) t.fontWeight = fontWeight;
  if (lineHeight != null) t.lineHeight = lineHeight;
  return t;
}

function walkElements(node: HTMLElement | any, visit: (el: HTMLElement) => void): void {
  if (node.nodeType === NodeType.ELEMENT_NODE) visit(node as HTMLElement);
  for (const child of node.childNodes ?? []) {
    walkElements(child, visit);
  }
}

function rgbaToHex(c: RGBA): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return (
    "#" + toHex(c.r) + toHex(c.g) + toHex(c.b) + (c.a < 1 ? toHex(c.a) : "")
  );
}
