declare module "postcss-safe-parser" {
  import type { Root, ProcessOptions } from "postcss";
  const safeParser: (css: string, opts?: ProcessOptions) => Root;
  export default safeParser;
}
