import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

// Figma's plugin sandbox only supports ES6 – must target es6 so that
// object spread ({...obj}), nullish coalescing (??), optional chaining (?.)
// and other post-ES6 syntax are down-compiled to ES5/ES6 equivalents.
await build({
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  platform: "browser",
  format: "iife",
  target: "es6"
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
