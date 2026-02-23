"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, { width: 360, height: 520 });
  function getSolidPaintColor() {
    const node = figma.currentPage.selection[0];
    if (!node || !("fills" in node)) return null;
    const fills = node.fills;
    const solid = fills.find((p) => p.type === "SOLID");
    return solid ? solid.color : null;
  }
  figma.ui.onmessage = (msg) => {
    if (msg.type === "request-selection-color") {
      figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
    }
    if (msg.type === "apply-solid-color") {
      const node = figma.currentPage.selection[0];
      if (!node || !("fills" in node)) return;
      const fills = node.fills;
      const next = fills.map(
        (p) => p.type === "SOLID" ? { ...p, color: msg.color } : p
      );
      node.fills = next;
      figma.notify("Applied OKColor edit");
    }
    if (msg.type === "close") {
      figma.closePlugin();
    }
  };
})();
