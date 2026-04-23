import { describe, it, expect } from "vitest";
import { runConvertHtmlToFigma } from "../src/tools/convertHtmlToFigma.js";
import { runParseCssToFigmaStyles } from "../src/tools/parseCssToFigmaStyles.js";
import { runExtractDesignTokens } from "../src/tools/extractDesignTokens.js";
import { runGenerateFigmaComponent } from "../src/tools/generateFigmaComponent.js";
import type { ComponentNode, FrameNode, TextNode } from "../src/types/figma.js";

describe("tool handlers", () => {
  it("convert_html_to_figma: returns node + warnings", async () => {
    const out = await runConvertHtmlToFigma({
      html: '<div style="background:#fff">hi</div>',
    });
    expect(out.node.type).toBe("FRAME");
    expect(Array.isArray(out.warnings)).toBe(true);
  });

  it("parse_css_to_figma_styles: inline style", () => {
    const out = runParseCssToFigmaStyles({ inlineStyle: "padding: 10px; opacity: 0.5" });
    expect(out.style.paddingTop).toBe(10);
    expect(out.style.opacity).toBe(0.5);
  });

  it("parse_css_to_figma_styles: full stylesheet rule body", () => {
    const out = runParseCssToFigmaStyles({ css: ".x { padding: 4px }" });
    expect(out.style.paddingTop).toBe(4);
  });

  it("parse_css_to_figma_styles: empty input warns", () => {
    const out = runParseCssToFigmaStyles({});
    expect(out.warnings.some((w) => w.code === "EMPTY_INPUT")).toBe(true);
  });

  it("extract_design_tokens: returns tokens and figma variables", () => {
    const out = runExtractDesignTokens({
      html: '<div style="color: #abcdef; padding: 6px"></div>',
    });
    expect(out.tokens.colors.length).toBeGreaterThan(0);
    expect(out.figmaVariables.variables.length).toBeGreaterThan(0);
  });

  it("generate_figma_component: builds COMPONENT with variants", () => {
    const out = runGenerateFigmaComponent({
      html: '<button style="padding: 8px">Submit</button>',
      componentName: "Button",
      variants: { size: ["sm", "md", "lg"] },
      properties: { label: { type: "TEXT", defaultValue: "Submit" } },
    });
    expect(out.component.type).toBe("COMPONENT");
    expect(out.component.name).toBe("Button");
    expect(out.component.componentPropertyDefinitions?.size?.variantOptions).toEqual(["sm", "md", "lg"]);
    expect(out.component.componentPropertyDefinitions?.label?.type).toBe("TEXT");
  });
});

describe("integration: example from README", () => {
  it("matches documented shape", async () => {
    const out = await runConvertHtmlToFigma({
      html: '<div style="background: #FF0000; padding: 16px"><p>Hello</p></div>',
    });
    const root = out.node as FrameNode;
    const div = root.children?.[0] as FrameNode;
    expect(div.fills).toEqual([{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }]);
    expect(div.paddingLeft).toBe(16);
    const text = div.children?.[0] as TextNode;
    expect(text.characters).toBe("Hello");
  });
});
