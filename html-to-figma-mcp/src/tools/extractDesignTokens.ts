import { z } from "zod";
import { extractTokens, toFigmaVariablesExport, type TokenSet } from "../mappers/tokens.js";

export const extractTokensInput = {
  html: z.string().describe("HTML source to scan for design tokens."),
  css: z.string().optional().describe("Optional external CSS to include."),
};

export type ExtractTokensResult = {
  tokens: TokenSet;
  figmaVariables: ReturnType<typeof toFigmaVariablesExport>;
};

export function runExtractDesignTokens(args: {
  html: string;
  css?: string;
}): ExtractTokensResult {
  const tokens = extractTokens(args.html, args.css);
  return { tokens, figmaVariables: toFigmaVariablesExport(tokens) };
}
