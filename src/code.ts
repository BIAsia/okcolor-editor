figma.showUI(__html__, { width: 360, height: 520 });

type RGB = { r: number; g: number; b: number };

function getSolidPaintColor(): RGB | null {
  const node = figma.currentPage.selection[0];
  if (!node || !("fills" in node)) return null;
  const fills = node.fills as ReadonlyArray<Paint>;
  const solid = fills.find((p) => p.type === "SOLID") as SolidPaint | undefined;
  return solid ? solid.color : null;
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "request-selection-color") {
    figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
  }

  if (msg.type === "apply-solid-color") {
    const node = figma.currentPage.selection[0];
    if (!node || !("fills" in node)) return;
    const fills = node.fills as ReadonlyArray<Paint>;
    const next = fills.map((p) =>
      p.type === "SOLID" ? { ...p, color: msg.color as RGB } : p
    );
    node.fills = next;
    figma.notify("Applied OKColor edit");
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
