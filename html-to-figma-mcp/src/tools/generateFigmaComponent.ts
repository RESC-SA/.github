import { z } from "zod";
import { convertHtmlToFigma as convertWithParser } from "../mappers/htmlToNodes.js";
import type { ComponentNode, FigmaNode, FrameNode, Warning } from "../types/figma.js";

export const generateComponentInput = {
  html: z.string().describe("HTML snippet for the component body."),
  componentName: z.string().describe("Figma component name."),
  variants: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe("Optional variant property definitions, e.g. { size: ['sm','md','lg'] }."),
  properties: z
    .record(z.string(), z.object({ type: z.enum(["TEXT", "BOOLEAN"]), defaultValue: z.union([z.string(), z.boolean()]) }))
    .optional()
    .describe("Optional component property definitions."),
};

export function runGenerateFigmaComponent(args: {
  html: string;
  componentName: string;
  variants?: Record<string, string[]>;
  properties?: Record<string, { type: "TEXT" | "BOOLEAN"; defaultValue: string | boolean }>;
}): { component: ComponentNode; warnings: Warning[] } {
  const { root, warnings } = convertWithParser(args.html, undefined, { rootName: args.componentName });
  const frame = root as FrameNode;
  const component: ComponentNode = {
    type: "COMPONENT",
    name: args.componentName,
    layoutMode: frame.layoutMode ?? "VERTICAL",
    itemSpacing: frame.itemSpacing,
    paddingTop: frame.paddingTop,
    paddingRight: frame.paddingRight,
    paddingBottom: frame.paddingBottom,
    paddingLeft: frame.paddingLeft,
    primaryAxisAlignItems: frame.primaryAxisAlignItems,
    counterAxisAlignItems: frame.counterAxisAlignItems,
    fills: frame.fills,
    strokes: frame.strokes,
    strokeWeight: frame.strokeWeight,
    effects: frame.effects,
    opacity: frame.opacity,
    cornerRadius: frame.cornerRadius,
    topLeftRadius: frame.topLeftRadius,
    topRightRadius: frame.topRightRadius,
    bottomLeftRadius: frame.bottomLeftRadius,
    bottomRightRadius: frame.bottomRightRadius,
    width: frame.width,
    height: frame.height,
    layoutSizingHorizontal: frame.layoutSizingHorizontal,
    layoutSizingVertical: frame.layoutSizingVertical,
    children: frame.children ?? [],
  };

  const propertyDefs: ComponentNode["componentPropertyDefinitions"] = {};
  if (args.variants) {
    for (const [name, opts] of Object.entries(args.variants)) {
      propertyDefs[name] = {
        type: "VARIANT",
        defaultValue: opts[0] ?? "",
        variantOptions: opts,
      };
    }
  }
  if (args.properties) {
    for (const [name, def] of Object.entries(args.properties)) {
      propertyDefs[name] = { type: def.type, defaultValue: def.defaultValue };
    }
  }
  if (Object.keys(propertyDefs).length) {
    component.componentPropertyDefinitions = propertyDefs;
  }

  return { component, warnings };
}
