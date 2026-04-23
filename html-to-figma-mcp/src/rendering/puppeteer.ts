export type RenderedElement = {
  tag: string;
  text?: string;
  computed: Record<string, string>;
  children: RenderedElement[];
};

export type RenderOptions = {
  viewport?: { width: number; height: number };
  waitFor?: string;
};

const COMPUTED_PROPS = [
  "display", "flex-direction", "justify-content", "align-items", "gap",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "background-color",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "box-shadow",
  "opacity",
  "width", "height",
  "color",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "text-align", "text-decoration", "text-transform",
];

async function loadPuppeteer() {
  try {
    const mod = await import("puppeteer-core");
    return mod.default ?? mod;
  } catch (e) {
    throw new Error(
      "puppeteer-core is not installed. Install it (`npm i puppeteer-core`) and set PUPPETEER_EXECUTABLE_PATH to a Chromium binary."
    );
  }
}

export async function renderHtmlToTree(
  source: { html: string } | { url: string },
  options: RenderOptions = {}
): Promise<RenderedElement> {
  const puppeteer = await loadPuppeteer();
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    throw new Error(
      "PUPPETEER_EXECUTABLE_PATH is not set; point it at a Chromium/Chrome executable."
    );
  }
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    if (options.viewport) await page.setViewport(options.viewport);
    if ("html" in source) {
      await page.setContent(source.html, { waitUntil: "networkidle0" });
    } else {
      await page.goto(source.url, { waitUntil: "networkidle0" });
    }
    if (options.waitFor) await page.waitForSelector(options.waitFor);

    const browserFn = new Function(
      "props",
      `
      function walk(el) {
        var cs = window.getComputedStyle(el);
        var computed = {};
        for (var i = 0; i < props.length; i++) {
          var p = props[i];
          computed[p] = cs.getPropertyValue(p);
        }
        var children = [];
        for (var j = 0; j < el.children.length; j++) {
          children.push(walk(el.children[j]));
        }
        var out = { tag: el.tagName.toLowerCase(), computed: computed, children: children };
        if (el.children.length === 0 && el.textContent) {
          var t = el.textContent.replace(/\\s+/g, " ").trim();
          if (t) out.text = t;
        }
        return out;
      }
      return walk(document.body);
    `
    ) as (props: string[]) => RenderedElement;

    return (await page.evaluate(browserFn, COMPUTED_PROPS)) as RenderedElement;
  } finally {
    await browser.close();
  }
}

export async function fetchUrlHtml(url: string): Promise<string> {
  const { fetch } = await import("undici");
  const res = await fetch(url, { headers: { "User-Agent": "html-to-figma-mcp/0.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return await res.text();
}
