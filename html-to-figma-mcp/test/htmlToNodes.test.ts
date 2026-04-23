import { describe, it, expect } from "vitest";
import { convertHtmlToFigma } from "../src/mappers/htmlToNodes.js";
import type { FrameNode, TextNode, RectangleNode, ComponentNode } from "../src/types/figma.js";

describe("convertHtmlToFigma", () => {
  it("matches the prompt's canonical example", () => {
    const { root } = convertHtmlToFigma(
      '<div style="background: #FF0000; padding: 16px"><p>Hello</p></div>'
    );
    const frame = (root as FrameNode).children?.[0] as FrameNode;
    expect(frame.type).toBe("FRAME");
    expect(frame.name).toBe("div");
    expect(frame.fills).toEqual([{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }]);
    expect(frame.paddingTop).toBe(16);
    expect(frame.paddingRight).toBe(16);
    expect(frame.paddingBottom).toBe(16);
    expect(frame.paddingLeft).toBe(16);
    const p = frame.children?.[0] as TextNode;
    expect(p.type).toBe("TEXT");
    expect(p.characters).toBe("Hello");
  });

  it("maps img to RECTANGLE with IMAGE fill", () => {
    const { root } = convertHtmlToFigma('<div><img src="https://x.test/a.png" alt="hero" /></div>');
    const frame = (root as FrameNode).children?.[0] as FrameNode;
    const img = frame.children?.[0] as RectangleNode;
    expect(img.type).toBe("RECTANGLE");
    expect(img.fills?.[0]).toMatchObject({ type: "IMAGE", imageUrl: "https://x.test/a.png" });
    expect(img.name).toBe("hero");
  });

  it("maps button to COMPONENT with inner text", () => {
    const { root } = convertHtmlToFigma('<div><button style="padding: 8px">Click</button></div>');
    const frame = (root as FrameNode).children?.[0] as FrameNode;
    const btn = frame.children?.[0] as ComponentNode;
    expect(btn.type).toBe("COMPONENT");
    expect(btn.paddingTop).toBe(8);
    const text = btn.children?.[0] as TextNode;
    expect(text.type).toBe("TEXT");
    expect(text.characters).toBe("Click");
  });

  it("applies external CSS by class selector", () => {
    const { root } = convertHtmlToFigma(
      '<div class="card"><span>Hi</span></div>',
      ".card { background: #00ff00; padding: 4px }"
    );
    const card = (root as FrameNode).children?.[0] as FrameNode;
    expect(card.fills).toEqual([{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 } }]);
    expect(card.paddingTop).toBe(4);
  });

  it("h1 defaults to larger font weight 700", () => {
    const { root } = convertHtmlToFigma("<h1>Title</h1>");
    const title = (root as FrameNode).children?.[0] as TextNode;
    expect(title.type).toBe("TEXT");
    expect(title.characters).toBe("Title");
    expect(title.style?.fontWeight).toBe(700);
    expect(title.style?.fontSize).toBe(32);
  });
});
