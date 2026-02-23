figma.showUI(__html__, { width: 360, height: 520 });

type RGB = { r: number; g: number; b: number };
type GradientStopMessage = { position: number; color: RGB };

function getSolidPaintColor(): RGB | null {
  const nodeWithFills = figma.currentPage.selection.find(
    (node): node is SceneNode & GeometryMixin => "fills" in node
  );
  if (!nodeWithFills) return null;
  const fills = nodeWithFills.fills as ReadonlyArray<Paint>;
  const solid = fills.find((p) => p.type === "SOLID") as SolidPaint | undefined;
  return solid ? solid.color : null;
}

function sanitizeGradientStops(stops: GradientStopMessage[]): ColorStop[] {
  const normalized = (stops ?? [])
    .map((stop) => ({
      position: Math.min(1, Math.max(0, Number(stop.position))),
      color: stop.color
    }))
    .filter((stop) =>
      Number.isFinite(stop.position) &&
      stop.color &&
      Number.isFinite(stop.color.r) &&
      Number.isFinite(stop.color.g) &&
      Number.isFinite(stop.color.b)
    )
    .sort((left, right) => left.position - right.position);

  if (normalized.length < 2) {
    return [
      { position: 0, color: { r: 0, g: 0, b: 0 }, a: 1 },
      { position: 1, color: { r: 1, g: 1, b: 1 }, a: 1 }
    ];
  }

  return normalized.map((stop) => ({
    position: stop.position,
    color: stop.color,
    a: 1
  }));
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
      const nextSolid: SolidPaint = {
        type: "SOLID",
        visible: true,
        opacity: 1,
        blendMode: "NORMAL",
        color: msg.color as RGB
      };

      const next =
        fills.length === 0
          ? [nextSolid]
          : [nextSolid, ...fills.filter((paint) => paint.type !== "SOLID")];

      try {
        node.fills = next;
        updatedNodes += 1;
      } catch {
        // Some nodes expose readonly paints at runtime; skip them.
      }
    }

    if (updatedNodes > 0) {
      figma.notify(`Applied OKColor edit to ${updatedNodes} layer${updatedNodes > 1 ? "s" : ""}`);
    } else {
      figma.notify("No selected layers with editable fills", { error: true });
    }
  }

  if (msg.type === "apply-gradient") {
    const gradientStops = sanitizeGradientStops(msg.stops as GradientStopMessage[]);
    let updatedNodes = 0;

    for (const node of figma.currentPage.selection) {
      if (!("fills" in node)) continue;
      const fills = node.fills as ReadonlyArray<Paint>;
      if (fills.length === 0) continue;

      const nextGradient: GradientPaint = {
        type: "GRADIENT_LINEAR",
        visible: true,
        opacity: 1,
        blendMode: "NORMAL",
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops
      };

      node.fills = [nextGradient, ...fills.filter((paint) => paint.type !== "SOLID")];
      updatedNodes += 1;
    }

    if (updatedNodes > 0) {
      figma.notify(`Applied gradient to ${updatedNodes} layer${updatedNodes > 1 ? "s" : ""}`);
    } else {
      figma.notify("No selected layers with editable fills", { error: true });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
