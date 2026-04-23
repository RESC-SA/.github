import { z } from "zod";
import { convertHtmlToFigma as convertWithParser } from "../mappers/htmlToNodes.js";
import { fetchUrlHtml, renderHtmlToTree } from "../rendering/puppeteer.js";
import { renderedTreeToFigma } from "./convertHtmlToFigma.js";
import type { FigmaNode, Warning } from "../types/figma.js";

export const convertUrlInput = {
  url: z.string().url().describe("URL to fetch and convert."),
  options: z
    .object({
      usePuppeteer: z.boolean().optional(),
      waitFor: z.string().optional(),
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
      rootName: z.string().optional(),
    })
    .optional(),
};

export async function runConvertUrlToFigma(args: {
  url: string;
  options?: {
    usePuppeteer?: boolean;
    waitFor?: string;
    viewport?: { width: number; height: number };
    rootName?: string;
  };
}): Promise<{ node: FigmaNode; warnings: Warning[]; sourceUrl: string }> {
  const opts = args.options ?? {};
  if (opts.usePuppeteer) {
    const tree = await renderHtmlToTree(
      { url: args.url },
      { viewport: opts.viewport, waitFor: opts.waitFor }
    );
    const { node, warnings } = renderedTreeToFigma(tree, opts.rootName ?? args.url);
    return { node, warnings, sourceUrl: args.url };
  }
  const html = await fetchUrlHtml(args.url);
  const { root, warnings } = convertWithParser(html, undefined, { rootName: opts.rootName });
  return { node: root, warnings, sourceUrl: args.url };
}
