import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  platform: "browser",
  format: "iife",
  target: "es2020"
});

await build({
  entryPoints: ["ui/ui.ts"],
  bundle: true,
  outfile: "dist/ui.js",
  platform: "browser",
  format: "esm",
  target: "es2020"
});

await copyFile("ui/index.html", "dist/ui.html");
console.log("Build complete");
