import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { convertHtmlInput, runConvertHtmlToFigma } from "./tools/convertHtmlToFigma.js";
import { parseCssInput, runParseCssToFigmaStyles } from "./tools/parseCssToFigmaStyles.js";
import { extractTokensInput, runExtractDesignTokens } from "./tools/extractDesignTokens.js";
import { convertUrlInput, runConvertUrlToFigma } from "./tools/convertUrlToFigma.js";
import { generateComponentInput, runGenerateFigmaComponent } from "./tools/generateFigmaComponent.js";

type CallToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: { [x: string]: unknown };
  isError?: boolean;
};

function ok(data: unknown): CallToolResult {
  const text = JSON.stringify(data, null, 2);
  const structured: { [x: string]: unknown } =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { [x: string]: unknown })
      : { value: data };
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
  };
}

function fail(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "html-to-figma",
    version: "0.1.0",
  });

  server.registerTool(
    "convert_html_to_figma",
    {
      title: "Convert HTML to Figma",
      description:
        "Convert an HTML string (optionally with external CSS) into a Figma-compatible node tree.",
      inputSchema: convertHtmlInput,
    },
    async (args) => {
      try {
        return ok(await runConvertHtmlToFigma(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "parse_css_to_figma_styles",
    {
      title: "Parse CSS to Figma styles",
      description:
        "Parse a CSS declaration block or inline style string into Figma style fields (fills, strokes, effects, typography, layout).",
      inputSchema: parseCssInput,
    },
    async (args) => {
      try {
        return ok(runParseCssToFigmaStyles(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "extract_design_tokens",
    {
      title: "Extract design tokens",
      description:
        "Extract color, typography, and spacing tokens from HTML/CSS and emit a Figma Variables export.",
      inputSchema: extractTokensInput,
    },
    async (args) => {
      try {
        return ok(runExtractDesignTokens(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "convert_url_to_figma",
    {
      title: "Convert URL to Figma",
      description:
        "Fetch a URL and convert the page's HTML/CSS into a Figma node tree. Optionally uses Puppeteer for computed styles.",
      inputSchema: convertUrlInput,
    },
    async (args) => {
      try {
        return ok(await runConvertUrlToFigma(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "generate_figma_component",
    {
      title: "Generate Figma component",
      description:
        "Build a Figma COMPONENT node (with optional variants and properties) from an HTML snippet.",
      inputSchema: generateComponentInput,
    },
    async (args) => {
      try {
        return ok(runGenerateFigmaComponent(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  return server;
}

// Re-export so callers can use this in integration tests without pulling zod in directly.
export { z };
