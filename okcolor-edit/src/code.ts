figma.showUI(__html__, { width: 360, height: 520 });

type RGB = { r: number; g: number; b: number };

function getSolidPaintColor(): RGB | null {
  const nodeWithFills = figma.currentPage.selection.find(
    (node): node is SceneNode & GeometryMixin => "fills" in node
  );
  if (!nodeWithFills) return null;
  const fills = nodeWithFills.fills as ReadonlyArray<Paint>;
  const solid = fills.find((p) => p.type === "SOLID") as SolidPaint | undefined;
  return solid ? solid.color : null;
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "request-selection-color") {
    figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
  }

  if (msg.type === "apply-solid-color") {
    let updatedNodes = 0;

    for (const node of figma.currentPage.selection) {
      if (!("fills" in node)) continue;
      const fills = node.fills as ReadonlyArray<Paint>;
      const hasSolid = fills.some((p) => p.type === "SOLID");
      if (!hasSolid) continue;

      const next = fills.map((p) =>
        p.type === "SOLID" ? { ...p, color: msg.color as RGB } : p
      );
      node.fills = next;
      updatedNodes += 1;
    }

    if (updatedNodes > 0) {
      figma.notify(`Applied OKColor edit to ${updatedNodes} layer${updatedNodes > 1 ? "s" : ""}`);
    } else {
      figma.notify("No selected layers with SOLID fill", { error: true });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
