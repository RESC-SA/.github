import { z } from "zod";
import type { Warning } from "../types/figma.js";
import { convertHtmlToFigma as convertWithParser } from "../mappers/htmlToNodes.js";
import { cssToFigma } from "../mappers/cssToFigma.js";
import { renderHtmlToTree, type RenderedElement } from "../rendering/puppeteer.js";
import { applyStyleToNode } from "../mappers/cssToFigma.js";
import type { FigmaNode, FrameNode, TextNode } from "../types/figma.js";

export const convertHtmlInput = {
  html: z.string().describe("HTML source to convert."),
  css: z.string().optional().describe("Optional external CSS stylesheet applied to the HTML."),
  options: z
    .object({
      usePuppeteer: z.boolean().optional(),
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
      rootName: z.string().optional(),
    })
    .optional(),
};

export async function runConvertHtmlToFigma(args: {
  html: string;
  css?: string;
  options?: { usePuppeteer?: boolean; viewport?: { width: number; height: number }; rootName?: string };
}): Promise<{ node: FigmaNode; warnings: Warning[] }> {
  const { html, css, options } = args;
  if (options?.usePuppeteer) {
    const tree = await renderHtmlToTree({ html }, { viewport: options.viewport });
    const { node, warnings } = renderedTreeToFigma(tree, options.rootName ?? "Root");
    return { node, warnings };
  }
  const { root, warnings } = convertWithParser(html, css, { rootName: options?.rootName });
  return { node: root, warnings };
}

export function renderedTreeToFigma(
  tree: RenderedElement,
  rootName: string
): { node: FigmaNode; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const node = renderToNode(tree, warnings, rootName);
  return { node, warnings };
}

function renderToNode(el: RenderedElement, warnings: Warning[], nameOverride?: string): FigmaNode {
  // Flatten computed shorthand-like props back to what cssToFigma expects.
  const decls: Record<string, string> = {};
  for (const [k, v] of Object.entries(el.computed)) {
    if (!v) continue;
    decls[k] = v;
  }
  // Reduce border-top-width etc. to border-width if all sides equal.
  const bw = ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"]
    .map((k) => decls[k]);
  if (bw.every((x) => x && x === bw[0]) && bw[0] && bw[0] !== "0px") {
    decls["border-width"] = bw[0];
  }
  const bc = ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]
    .map((k) => decls[k]);
  if (bc.every((x) => x && x === bc[0]) && bc[0]) {
    decls["border-color"] = bc[0];
  }
  // Combine corner radii → border-radius if all equal.
  const br = [
    "border-top-left-radius", "border-top-right-radius",
    "border-bottom-right-radius", "border-bottom-left-radius",
  ].map((k) => decls[k]);
  if (br.every((x) => x && x === br[0]) && br[0]) {
    decls["border-radius"] = br[0];
  }

  const isText = el.children.length === 0 && !!el.text;

  if (isText) {
    const t: TextNode = { type: "TEXT", name: el.tag, characters: el.text!, style: {} };
    const mapped = cssToFigma(decls);
    warnings.push(...mapped.warnings);
    applyStyleToNode(t, mapped.style);
    return t;
  }

  const frame: FrameNode = {
    type: "FRAME",
    name: nameOverride ?? el.tag,
    layoutMode: decls["display"]?.includes("flex") ? "HORIZONTAL" : "VERTICAL",
    children: [],
  };
  const mapped = cssToFigma(decls);
  warnings.push(...mapped.warnings);
  applyStyleToNode(frame, mapped.style);

  for (const child of el.children) {
    frame.children!.push(renderToNode(child, warnings));
  }
  return frame;
}
