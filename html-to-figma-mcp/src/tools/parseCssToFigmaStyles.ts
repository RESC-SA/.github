import { z } from "zod";
import { cssToFigma, parseDeclarationBlock, type FigmaStyleBag } from "../mappers/cssToFigma.js";
import type { Warning } from "../types/figma.js";

export const parseCssInput = {
  css: z.string().optional().describe("A stylesheet or declaration block (like '.card { padding: 8px }' or 'padding: 8px')."),
  inlineStyle: z.string().optional().describe("Inline style string (same as the HTML 'style' attribute)."),
};

export type ParseCssResult = {
  style: FigmaStyleBag;
  warnings: Warning[];
};

export function runParseCssToFigmaStyles(args: {
  css?: string;
  inlineStyle?: string;
}): ParseCssResult {
  if (!args.css && !args.inlineStyle) {
    return {
      style: {},
      warnings: [{ code: "EMPTY_INPUT", message: "Provide either 'css' or 'inlineStyle'." }],
    };
  }
  const source = args.inlineStyle ?? stripSelectors(args.css!);
  const decls = parseDeclarationBlock(source);
  return cssToFigma(decls);
}

function stripSelectors(css: string): string {
  // If the input looks like a full stylesheet (contains `{`), take the first rule body.
  const m = css.match(/\{([^}]*)\}/);
  if (m) return m[1]!;
  return css;
}
