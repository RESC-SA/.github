# html-to-figma-mcp

An MCP (Model Context Protocol) server that converts HTML/CSS into
Figma-compatible JSON node trees. Lets an AI assistant turn web content into
Figma designs.

## Tools

| Tool | Purpose |
|---|---|
| `convert_html_to_figma` | HTML (+ optional CSS) → Figma node tree rooted at a `FRAME`. |
| `parse_css_to_figma_styles` | CSS declaration block / inline style → Figma style fields (fills, strokes, effects, typography, layout). |
| `extract_design_tokens` | HTML (+ optional CSS) → deduped colors / typography / spacing, plus a Figma Variables export. |
| `convert_url_to_figma` | Fetch a URL and convert its page. Optional Puppeteer-based computed styles. |
| `generate_figma_component` | HTML snippet + name (+ optional variants/properties) → Figma `COMPONENT`. |

Outputs match the shape consumed by `figma.createNodeFromJson` and the
Figma REST API (types, paints, effects, layout modes, etc.).

## Install & build

```bash
npm install
npm run build
```

This produces `dist/index.js`. You can run the server directly:

```bash
node dist/index.js
```

Or in dev mode (no build step) with `npm run dev`.

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "html-to-figma": {
      "command": "node",
      "args": ["/absolute/path/to/html-to-figma-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop; the five tools appear in the tool picker.

## Puppeteer (optional)

For fidelity with real stylesheets, inheritance, and `em`/`rem`, pass
`options.usePuppeteer: true` to `convert_html_to_figma` or
`convert_url_to_figma`. Install `puppeteer-core` and set
`PUPPETEER_EXECUTABLE_PATH` to a Chromium/Chrome binary:

```bash
npm i puppeteer-core @puppeteer/browsers
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

Without Puppeteer, the server parses inline and external CSS directly — no
Chromium required.

## Example

Input:

```html
<div style="background: #FF0000; padding: 16px"><p>Hello</p></div>
```

Output (abridged):

```json
{
  "node": {
    "type": "FRAME",
    "name": "Root",
    "children": [{
      "type": "FRAME",
      "name": "div",
      "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 0, "b": 0, "a": 1 } }],
      "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16,
      "children": [{
        "type": "TEXT",
        "characters": "Hello",
        "style": { "fontFamily": "Inter", "fontSize": 16, "fontWeight": 400 }
      }]
    }]
  },
  "warnings": []
}
```

## Mapping rules (summary)

- `display: flex` → AUTO_LAYOUT frame, `flex-direction` → `layoutMode`.
- `gap` → `itemSpacing`; `padding*` → `paddingTop/Right/Bottom/Left`.
- `background-color`/`background` → `fills`.
- `border` shorthand → `strokes` + `strokeWeight`.
- `border-radius` (incl. four-value form) → `cornerRadius` / per-corner.
- `box-shadow` (multiple, inset) → `effects` (`DROP_SHADOW`/`INNER_SHADOW`).
- Typography props → `TEXT.style` + text `fills`.
- `width`/`height`: `100%` → `FILL`, `auto`/`fit-content` → `HUG`, px → `FIXED`.

Unknown declarations are collected in `warnings[]` instead of crashing.

## Testing

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
```

## Status / scope

v0.1. Not yet on npm. Image fills keep the source URL in `imageUrl` — the
caller is expected to resolve that to a Figma `imageHash`. CSS grid,
pseudo-elements, and media queries are out of scope for v1.
