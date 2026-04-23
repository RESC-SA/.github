import safeParser from "postcss-safe-parser";
import type {
  DropShadowEffect,
  FigmaNode,
  FrameNode,
  Paint,
  TextNode,
  TypographyStyle,
  Warning,
} from "../types/figma.js";
import { parseColor } from "./colors.js";
import { expandShorthand4, parseLength, parsePercentage } from "./units.js";

export type FigmaStyleBag = {
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  effects?: DropShadowEffect[];
  opacity?: number;
  cornerRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomLeftRadius?: number;
  bottomRightRadius?: number;
  width?: number;
  height?: number;
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: FrameNode["primaryAxisAlignItems"];
  counterAxisAlignItems?: FrameNode["counterAxisAlignItems"];
  typography?: TypographyStyle;
  textFills?: Paint[];
};

export type MapOutput = {
  style: FigmaStyleBag;
  warnings: Warning[];
};

const KNOWN_PROPS = new Set([
  "display", "flex-direction", "justify-content", "align-items", "gap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "background", "background-color",
  "border", "border-width", "border-style", "border-color",
  "border-radius", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "box-shadow",
  "opacity",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "color",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "text-align", "text-decoration", "text-transform",
]);

export function parseDeclarationBlock(css: string): Record<string, string> {
  const decls: Record<string, string> = {};
  try {
    const root = safeParser(`__tmp__{${css}}`);
    root.walkDecls((d) => {
      decls[d.prop.trim().toLowerCase()] = d.value.trim();
    });
  } catch {
    // Fall back: manual semi-split.
    for (const chunk of css.split(";")) {
      const idx = chunk.indexOf(":");
      if (idx < 0) continue;
      const prop = chunk.slice(0, idx).trim().toLowerCase();
      const value = chunk.slice(idx + 1).trim();
      if (prop) decls[prop] = value;
    }
  }
  return decls;
}

export function cssToFigma(decls: Record<string, string>): MapOutput {
  const style: FigmaStyleBag = {};
  const warnings: Warning[] = [];

  for (const [propRaw, valueRaw] of Object.entries(decls)) {
    const prop = propRaw.toLowerCase();
    const value = valueRaw.trim();
    try {
      applyDeclaration(prop, value, style, warnings);
    } catch (e) {
      warnings.push({
        code: "DECL_ERROR",
        property: prop,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { style, warnings };
}

function applyDeclaration(
  prop: string,
  value: string,
  style: FigmaStyleBag,
  warnings: Warning[]
): void {
  if (!KNOWN_PROPS.has(prop)) {
    warnings.push({ code: "UNSUPPORTED", property: prop, message: `Ignored '${prop}: ${value}'` });
    return;
  }

  switch (prop) {
    case "display": {
      if (value === "flex" || value === "inline-flex") {
        style.layoutMode ??= "HORIZONTAL";
      } else if (value === "none") {
        style.opacity = 0;
      }
      return;
    }
    case "flex-direction": {
      if (value.startsWith("row")) style.layoutMode = "HORIZONTAL";
      else if (value.startsWith("column")) style.layoutMode = "VERTICAL";
      return;
    }
    case "justify-content": {
      style.primaryAxisAlignItems = mapJustify(value);
      return;
    }
    case "align-items": {
      style.counterAxisAlignItems = mapAlign(value);
      return;
    }
    case "gap": {
      const len = parseLength(value);
      if (len != null) style.itemSpacing = len;
      return;
    }
    case "padding": {
      const sides = expandShorthand4(value);
      if (!sides) return;
      const [top, right, bottom, left] = sides;
      style.paddingTop = top;
      style.paddingRight = right;
      style.paddingBottom = bottom;
      style.paddingLeft = left;
      return;
    }
    case "padding-top":
    case "padding-right":
    case "padding-bottom":
    case "padding-left": {
      const len = parseLength(value);
      if (len == null) return;
      const key = ("padding" + cap(prop.slice("padding-".length))) as
        | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";
      style[key] = len;
      return;
    }
    case "margin":
    case "margin-top":
    case "margin-right":
    case "margin-bottom":
    case "margin-left": {
      // Figma has no margin concept; inform caller once per occurrence.
      warnings.push({
        code: "NO_MARGIN",
        property: prop,
        message: "Figma has no margin; consider using parent itemSpacing/padding.",
      });
      return;
    }
    case "background":
    case "background-color": {
      const paint = colorToPaint(value);
      if (paint) style.fills = [paint];
      else
        warnings.push({
          code: "BG_UNSUPPORTED",
          property: prop,
          message: `Cannot map background '${value}'`,
        });
      return;
    }
    case "border": {
      const parsed = parseBorderShorthand(value);
      if (!parsed) {
        warnings.push({ code: "BORDER_PARSE", property: prop, message: `Unparsed border '${value}'` });
        return;
      }
      if (parsed.width != null) style.strokeWeight = parsed.width;
      if (parsed.color) style.strokes = [{ type: "SOLID", color: parsed.color }];
      return;
    }
    case "border-width": {
      const len = parseLength(value);
      if (len != null) style.strokeWeight = len;
      return;
    }
    case "border-color": {
      const c = parseColor(value);
      if (c) style.strokes = [{ type: "SOLID", color: c }];
      return;
    }
    case "border-style": {
      // Figma represents style via stroke dash pattern; unsupported → warn on non-solid.
      if (value !== "solid") {
        warnings.push({
          code: "BORDER_STYLE",
          property: prop,
          message: `Only solid borders supported (got '${value}')`,
        });
      }
      return;
    }
    case "border-radius": {
      const parts = value.split("/")[0]!.trim().split(/\s+/);
      const nums = parts.map((p) => parseLength(p));
      if (nums.some((n) => n == null)) return;
      if (parts.length === 1) {
        style.cornerRadius = nums[0]!;
      } else {
        const [tl, tr, br, bl] = [
          nums[0]!,
          nums[1] ?? nums[0]!,
          nums[2] ?? nums[0]!,
          nums[3] ?? nums[1] ?? nums[0]!,
        ];
        style.topLeftRadius = tl;
        style.topRightRadius = tr;
        style.bottomRightRadius = br;
        style.bottomLeftRadius = bl;
      }
      return;
    }
    case "border-top-left-radius":
    case "border-top-right-radius":
    case "border-bottom-left-radius":
    case "border-bottom-right-radius": {
      const len = parseLength(value);
      if (len == null) return;
      const map: Record<string, keyof FigmaStyleBag> = {
        "border-top-left-radius": "topLeftRadius",
        "border-top-right-radius": "topRightRadius",
        "border-bottom-left-radius": "bottomLeftRadius",
        "border-bottom-right-radius": "bottomRightRadius",
      };
      (style[map[prop]!] as number) = len;
      return;
    }
    case "box-shadow": {
      const effects = parseBoxShadow(value);
      if (effects.length) style.effects = effects;
      else
        warnings.push({
          code: "SHADOW_PARSE",
          property: prop,
          message: `Unparsed box-shadow '${value}'`,
        });
      return;
    }
    case "opacity": {
      const n = parseFloat(value);
      if (!Number.isNaN(n)) style.opacity = Math.max(0, Math.min(1, n));
      return;
    }
    case "width":
    case "height": {
      const which = prop === "width" ? "Horizontal" : "Vertical";
      const sizingKey = `layoutSizing${which}` as const;
      const dimKey = prop as "width" | "height";
      if (value === "auto" || value === "fit-content") {
        (style as Record<string, unknown>)[sizingKey] = "HUG";
      } else if (parsePercentage(value) === 100) {
        (style as Record<string, unknown>)[sizingKey] = "FILL";
      } else {
        const len = parseLength(value);
        if (len != null) {
          (style as Record<string, unknown>)[dimKey] = len;
          (style as Record<string, unknown>)[sizingKey] = "FIXED";
        }
      }
      return;
    }
    case "min-width":
    case "min-height":
    case "max-width":
    case "max-height": {
      warnings.push({
        code: "MINMAX_UNSUPPORTED",
        property: prop,
        message: "Figma uses layoutSizing; min/max are approximated as fixed if needed.",
      });
      return;
    }
    case "color": {
      const c = parseColor(value);
      if (c) style.textFills = [{ type: "SOLID", color: c }];
      return;
    }
    case "font-family": {
      (style.typography ??= {}).fontFamily = value.split(",")[0]!.trim().replace(/['"]/g, "");
      return;
    }
    case "font-size": {
      const len = parseLength(value);
      if (len != null) (style.typography ??= {}).fontSize = len;
      return;
    }
    case "font-weight": {
      const n = parseFontWeight(value);
      if (n != null) (style.typography ??= {}).fontWeight = n;
      return;
    }
    case "line-height": {
      const t = style.typography ??= {};
      if (value === "normal") {
        t.lineHeight = { value: 0, unit: "AUTO" };
      } else if (value.endsWith("%")) {
        t.lineHeight = { value: parseFloat(value), unit: "PERCENT" };
      } else if (value.endsWith("px") || value.endsWith("em") || value.endsWith("rem")) {
        const n = parseLength(value);
        if (n != null) t.lineHeight = { value: n, unit: "PIXELS" };
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        t.lineHeight = { value: parseFloat(value) * 100, unit: "PERCENT" };
      }
      return;
    }
    case "letter-spacing": {
      const len = parseLength(value);
      if (len != null) (style.typography ??= {}).letterSpacing = { value: len, unit: "PIXELS" };
      return;
    }
    case "text-align": {
      const t = style.typography ??= {};
      const map: Record<string, TypographyStyle["textAlignHorizontal"]> = {
        left: "LEFT", right: "RIGHT", center: "CENTER", justify: "JUSTIFIED",
      };
      if (map[value]) t.textAlignHorizontal = map[value];
      return;
    }
    case "text-decoration": {
      const t = style.typography ??= {};
      if (value.includes("underline")) t.textDecoration = "UNDERLINE";
      else if (value.includes("line-through")) t.textDecoration = "STRIKETHROUGH";
      else if (value === "none") t.textDecoration = "NONE";
      return;
    }
    case "text-transform": {
      const t = style.typography ??= {};
      const map: Record<string, TypographyStyle["textCase"]> = {
        uppercase: "UPPER", lowercase: "LOWER", capitalize: "TITLE", none: "ORIGINAL",
      };
      if (map[value]) t.textCase = map[value];
      return;
    }
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapJustify(v: string): FrameNode["primaryAxisAlignItems"] {
  switch (v) {
    case "flex-start":
    case "start":
      return "MIN";
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    case "space-between":
      return "SPACE_BETWEEN";
    default:
      return "MIN";
  }
}

function mapAlign(v: string): FrameNode["counterAxisAlignItems"] {
  switch (v) {
    case "flex-start":
    case "start":
      return "MIN";
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    case "baseline":
      return "BASELINE";
    default:
      return "MIN";
  }
}

function colorToPaint(value: string): Paint | null {
  const c = parseColor(value);
  if (c) return { type: "SOLID", color: c };
  // naive url() detection
  const url = value.match(/url\((['"]?)([^'")]+)\1\)/);
  if (url) return { type: "IMAGE", imageUrl: url[2]!, scaleMode: "FILL" };
  return null;
}

function parseBorderShorthand(value: string): { width?: number; color?: import("../types/figma.js").RGBA } | null {
  const tokens = value.trim().split(/\s+/);
  let width: number | undefined;
  let color: import("../types/figma.js").RGBA | undefined;
  for (const tok of tokens) {
    const len = parseLength(tok);
    if (len != null && width == null) {
      width = len;
      continue;
    }
    const c = parseColor(tok);
    if (c) color = c;
  }
  if (width == null && color == null) return null;
  return { width, color };
}

function parseBoxShadow(value: string): DropShadowEffect[] {
  // Split on top-level commas (respecting parentheses).
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);

  const effects: DropShadowEffect[] = [];
  for (const raw of parts) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "none") continue;
    // Extract color first (last color-looking token).
    const colorMatch = trimmed.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/);
    let remainder = trimmed;
    let color: import("../types/figma.js").RGBA | null = null;
    if (colorMatch) {
      const maybe = parseColor(colorMatch[1]!);
      if (maybe) {
        color = maybe;
        remainder = trimmed.slice(0, trimmed.length - colorMatch[1]!.length).trim();
      }
    }
    const inset = /\binset\b/.test(remainder);
    remainder = remainder.replace(/\binset\b/g, "").trim();
    const nums = remainder.split(/\s+/).map((t) => parseLength(t));
    if (nums.length < 2 || nums[0] == null || nums[1] == null) continue;
    effects.push({
      type: inset ? "INNER_SHADOW" : "DROP_SHADOW",
      offset: { x: nums[0]!, y: nums[1]! },
      radius: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      color: color ?? { r: 0, g: 0, b: 0, a: 0.25 },
      visible: true,
      blendMode: "NORMAL",
    });
  }
  return effects;
}

function parseFontWeight(v: string): number | null {
  const map: Record<string, number> = {
    normal: 400, bold: 700, lighter: 300, bolder: 800,
    thin: 100, "extra-light": 200, light: 300, regular: 400,
    medium: 500, "semi-bold": 600, semibold: 600,
    "extra-bold": 800, extrabold: 800, black: 900, heavy: 900,
  };
  if (map[v] != null) return map[v]!;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export function applyStyleToNode(node: FigmaNode, style: FigmaStyleBag): void {
  // Apply the subset that's compatible with each node type. Text nodes also
  // pick up textFills as their `fills`.
  if (style.fills) node.fills = style.fills;
  if (style.strokes) node.strokes = style.strokes;
  if (style.strokeWeight != null) node.strokeWeight = style.strokeWeight;
  if (style.effects) node.effects = style.effects;
  if (style.opacity != null) node.opacity = style.opacity;
  if (style.cornerRadius != null) node.cornerRadius = style.cornerRadius;
  if (style.topLeftRadius != null) node.topLeftRadius = style.topLeftRadius;
  if (style.topRightRadius != null) node.topRightRadius = style.topRightRadius;
  if (style.bottomLeftRadius != null) node.bottomLeftRadius = style.bottomLeftRadius;
  if (style.bottomRightRadius != null) node.bottomRightRadius = style.bottomRightRadius;
  if (style.width != null) node.width = style.width;
  if (style.height != null) node.height = style.height;
  if (style.layoutSizingHorizontal) node.layoutSizingHorizontal = style.layoutSizingHorizontal;
  if (style.layoutSizingVertical) node.layoutSizingVertical = style.layoutSizingVertical;

  if (node.type === "FRAME" || node.type === "COMPONENT") {
    const f = node as FrameNode;
    if (style.layoutMode) f.layoutMode = style.layoutMode;
    if (style.itemSpacing != null) f.itemSpacing = style.itemSpacing;
    if (style.paddingTop != null) f.paddingTop = style.paddingTop;
    if (style.paddingRight != null) f.paddingRight = style.paddingRight;
    if (style.paddingBottom != null) f.paddingBottom = style.paddingBottom;
    if (style.paddingLeft != null) f.paddingLeft = style.paddingLeft;
    if (style.primaryAxisAlignItems) f.primaryAxisAlignItems = style.primaryAxisAlignItems;
    if (style.counterAxisAlignItems) f.counterAxisAlignItems = style.counterAxisAlignItems;
  }

  if (node.type === "TEXT") {
    const t = node as TextNode;
    if (style.typography) t.style = { ...(t.style ?? {}), ...style.typography };
    if (style.textFills) t.fills = style.textFills;
  }
}
