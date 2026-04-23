const ROOT_FONT_SIZE = 16;

export function parseLength(
  input: string | undefined,
  parentFontSize = ROOT_FONT_SIZE
): number | null {
  if (input == null) return null;
  const v = input.trim().toLowerCase();
  if (!v || v === "auto" || v === "inherit" || v === "initial" || v === "unset") return null;

  const num = parseFloat(v);
  if (Number.isNaN(num)) return null;

  if (v.endsWith("px")) return num;
  if (v.endsWith("rem")) return num * ROOT_FONT_SIZE;
  if (v.endsWith("em")) return num * parentFontSize;
  if (v.endsWith("pt")) return num * (96 / 72);
  if (v.endsWith("pc")) return num * 16;
  if (v.endsWith("in")) return num * 96;
  if (v.endsWith("cm")) return num * (96 / 2.54);
  if (v.endsWith("mm")) return num * (96 / 25.4);
  if (v.endsWith("%")) return null;
  // Bare number — treat as pixels for convenience.
  if (/^-?\d+(\.\d+)?$/.test(v)) return num;
  return null;
}

export function isPercentage(input: string | undefined): boolean {
  return !!input && input.trim().endsWith("%");
}

export function parsePercentage(input: string | undefined): number | null {
  if (!input) return null;
  const v = input.trim();
  if (!v.endsWith("%")) return null;
  const num = parseFloat(v);
  return Number.isNaN(num) ? null : num;
}

export function expandShorthand4(value: string): [number, number, number, number] | null {
  const parts = value.trim().split(/\s+/);
  const nums = parts.map((p) => parseLength(p));
  if (nums.some((n) => n == null)) return null;
  const [a, b, c, d] = nums as number[];
  if (parts.length === 1) return [a!, a!, a!, a!];
  if (parts.length === 2) return [a!, b!, a!, b!];
  if (parts.length === 3) return [a!, b!, c!, b!];
  if (parts.length === 4) return [a!, b!, c!, d!];
  return null;
}
