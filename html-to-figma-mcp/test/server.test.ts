import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("constructs without throwing and exposes an McpServer", () => {
    const server = createServer();
    expect(server).toBeDefined();
    // The SDK exposes a .server getter; just sanity-check the instance.
    expect(typeof (server as unknown as { server: unknown }).server).toBe("object");
  });
});
