import { build, context } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { watch } from "node:fs";

const isWatch = process.argv.includes("--watch");
const pluginTarget = "es2017";

const codeOptions = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  platform: "browser",
  format: "iife",
  target: pluginTarget
};

const uiOptions = {
  entryPoints: ["ui/ui.ts"],
  bundle: true,
  outfile: "dist/ui.js",
  platform: "browser",
  format: "esm",
  target: "es2020"
};

async function copyUiHtml() {
  await copyFile("ui/index.html", "dist/ui.html");
}

await mkdir("dist", { recursive: true });

if (isWatch) {
  const codeContext = await context(codeOptions);
  const uiContext = await context(uiOptions);

  await codeContext.watch();
  await uiContext.watch();
  await copyUiHtml();

  watch("ui/index.html", async (eventType) => {
    if (eventType !== "change") return;
    try {
      await copyUiHtml();
      console.log("[watch] ui/index.html copied -> dist/ui.html");
    } catch (error) {
      console.error("[watch] failed to copy ui/index.html", error);
    }
  });

  console.log(`Build watch started (plugin target: ${pluginTarget}).`);
  console.log("Keep this terminal open while testing in Figma.");
  await new Promise(() => {});
} else {
  await build(codeOptions);
  await build(uiOptions);
  await copyUiHtml();
  console.log(`Build complete (plugin target: ${pluginTarget}).`);
}
