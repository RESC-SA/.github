import type { RGBA } from "../types/figma.js";

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  transparent: "rgba(0,0,0,0)",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  teal: "#008080",
  navy: "#000080",
  fuchsia: "#ff00ff",
  purple: "#800080",
  orange: "#ffa500",
  pink: "#ffc0cb",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function parseColor(input: string): RGBA | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (raw === "inherit" || raw === "currentcolor" || raw === "initial" || raw === "unset") {
    return null;
  }

  const resolved = NAMED_COLORS[raw] ?? raw;

  if (resolved.startsWith("#")) {
    return parseHex(resolved);
  }
  if (resolved.startsWith("rgb")) {
    return parseRgb(resolved);
  }
  if (resolved.startsWith("hsl")) {
    return parseHsl(resolved);
  }
  return null;
}

function parseHex(hex: string): RGBA | null {
  const h = hex.replace("#", "");
  let r = 0, g = 0, b = 0, a = 1;
  if (h.length === 3 || h.length === 4) {
    r = parseInt(h[0]! + h[0]!, 16);
    g = parseInt(h[1]! + h[1]!, 16);
    b = parseInt(h[2]! + h[2]!, 16);
    if (h.length === 4) a = parseInt(h[3]! + h[3]!, 16) / 255;
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r: r / 255, g: g / 255, b: b / 255, a: clamp01(a) };
}

function parseRgb(str: string): RGBA | null {
  const match = str.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1]!.split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const toChan = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
  const r = toChan(parts[0]!);
  const g = toChan(parts[1]!);
  const b = toChan(parts[2]!);
  const aRaw = parts[3];
  const a = aRaw == null ? 1 : aRaw.endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return { r: clamp01(r / 255), g: clamp01(g / 255), b: clamp01(b / 255), a: clamp01(a) };
}

function parseHsl(str: string): RGBA | null {
  const match = str.match(/hsla?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1]!.split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]!) / 360;
  const s = parseFloat(parts[1]!) / 100;
  const l = parseFloat(parts[2]!) / 100;
  const aRaw = parts[3];
  const a = aRaw == null ? 1 : aRaw.endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
  if ([h, s, l, a].some((n) => Number.isNaN(n))) return null;

  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue(h + 1 / 3);
  const g = hue(h);
  const b = hue(h - 1 / 3);
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
}

export function colorKey(c: RGBA): string {
  return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a.toFixed(3)}`;
}
