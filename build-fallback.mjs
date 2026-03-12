/**
 * Fallback build script using TypeScript's transpileModule API.
 * Used when esbuild is not available.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Use the TypeScript compiler API bundled in node_modules
const ts = require("./node_modules/typescript/lib/typescript.js");

// ── TypeScript transpiler ─────────────────────────────────

function transpileTS(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None, // No module system – produces plain JS
      removeComments: false,
      strict: false,
      noEmitHelpers: false,
    },
  });
  return result.outputText;
}

// ── Strip TypeScript-only syntax before transpilation ─────

/**
 * Remove all import statements.
 * TypeScript's transpileModule doesn't resolve cross-file imports,
 * so we inline dependencies manually.
 */
function stripImports(source) {
  // Multi-line imports: import { ... } from "..."
  source = source.replace(/^import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  source = source.replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  source = source.replace(/^import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  source = source.replace(/^import\s+\w+\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  return source;
}

/**
 * Strip `export` keyword from declarations so they become globals.
 * Type-only exports are removed entirely since they're erased in JS.
 */
function stripExports(source) {
  // Remove: export type Foo = ...  (single line)
  source = source.replace(/^export\s+type\s+\w[^\n]*$/gm, "");
  // Remove: export interface Foo { ... }  and  export type Foo = { ... }
  // (multi-line handled by removing `export ` prefix)
  // Remove export from: export function / export const / export interface / export class / export enum
  source = source.replace(/^export\s+(function|const|let|var|class|interface|enum|abstract)/gm, "$1");
  // Remove: export { ... };
  source = source.replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
  // Remove: export default
  source = source.replace(/^export\s+default\s+/gm, "const _default = ");
  return source;
}

// ── Build dist/code.js ────────────────────────────────────

function buildCode() {
  const source = readFileSync("src/code.ts", "utf-8");
  const js = transpileTS(source);
  // Figma plugin backend must be in IIFE format
  writeFileSync("dist/code.js", `(function () {\n${js}\n})();\n`);
  console.log("  ✓ dist/code.js");
}

// ── Build dist/ui.js  ─────────────────────────────────────

function buildUI() {
  // 1. Transpile color.ts as a set of globals (no module system)
  const colorSrc = stripExports(readFileSync("src/color.ts", "utf-8"));
  const colorJs = transpileTS(colorSrc);

  // 2. Transpile ui.ts, replacing imports with blank lines
  const uiSrc = stripImports(readFileSync("ui/ui.ts", "utf-8"));
  const uiJs = transpileTS(uiSrc);

  writeFileSync(
    "dist/ui.js",
    `// ── OKColor Editor UI Bundle ──────────────────────────────────\n` +
      `// color math (inlined from src/color.ts)\n` +
      colorJs +
      `\n// ui logic (inlined from ui/ui.ts)\n` +
      uiJs +
      `\n`
  );
  console.log("  ✓ dist/ui.js");
}

// ── Copy HTML ─────────────────────────────────────────────

function buildHtml() {
  copyFileSync("ui/index.html", "dist/ui.html");
  console.log("  ✓ dist/ui.html");
}

// ── Main ──────────────────────────────────────────────────

console.log("Building OKColor Editor (TypeScript fallback build)…");
mkdirSync("dist", { recursive: true });
buildCode();
buildUI();
buildHtml();
console.log("Build complete!");
