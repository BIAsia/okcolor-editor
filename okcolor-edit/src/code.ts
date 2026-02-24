import {
  applyCurve,
  computeRegionMaskWeight,
  enforceGamut,
  getCurvePreset,
  oklabToOklch,
  oklabToRgbUnclamped,
  oklchToOklab,
  rgbToOklab,
  type CurvePoint,
  type CurvePresetId,
  type GamutPolicy,
  type RegionMask,
  type RGB
} from "./color";
import { findGradientOrSolidReplaceIndex, isGradientPaintType, replaceAtOrPrepend } from "./paint-utils";

figma.showUI(__html__, { width: 360, height: 520 });

type GradientStopMessage = { position: number; color: RGB };

type SolidAdjustmentSettings = {
  l: number;
  a: number;
  b: number;
  c: number;
  h: number;
  curvePreset: CurvePresetId;
  curveMid: number;
  curveMidA: number;
  curveMidB: number;
  gamutPolicy: GamutPolicy;
  mask: RegionMask;
};

function getSolidPaintColor(): RGB | null {
  const nodeWithFills = figma.currentPage.selection.find(
    (node): node is SceneNode & GeometryMixin => "fills" in node
  );
  if (!nodeWithFills) return null;
  const fills = nodeWithFills.fills as ReadonlyArray<Paint>;
  const solid = fills.find((p) => p.type === "SOLID") as SolidPaint | undefined;
  return solid ? solid.color : null;
}

function getLumaCurve(settings: SolidAdjustmentSettings): CurvePoint[] {
  if (settings.curvePreset === "custom") {
    return [
      { x: 0, y: 0 },
      { x: 0.5, y: settings.curveMid },
      { x: 1, y: 1 }
    ];
  }
  return getCurvePreset(settings.curvePreset);
}

function getAxisCurve(mid: number): CurvePoint[] {
  return [
    { x: 0, y: 0 },
    { x: 0.5, y: mid },
    { x: 1, y: 1 }
  ];
}

function applySolidAdjustment(base: RGB, settings: SolidAdjustmentSettings): RGB {
  const baseLab = rgbToOklab(base);
  const baseLch = oklabToOklch(baseLab);
  const maskWeight = computeRegionMaskWeight(baseLch, settings.mask);

  const shiftedLab = {
    l: baseLab.l + settings.l * maskWeight,
    a: baseLab.a + settings.a * maskWeight,
    b: baseLab.b + settings.b * maskWeight
  };

  const shiftedLch = oklabToOklch(shiftedLab);
  const adjustedLch = {
    l: shiftedLch.l,
    c: Math.max(0, shiftedLch.c + settings.c * maskWeight),
    h: (shiftedLch.h + settings.h * maskWeight + 360) % 360
  };

  const labAfterLch = oklchToOklab(adjustedLch);
  const curveL = getLumaCurve(settings);
  const curveA = getAxisCurve(settings.curveMidA);
  const curveB = getAxisCurve(settings.curveMidB);
  const normA = (labAfterLch.a + 0.4) / 0.8;
  const normB = (labAfterLch.b + 0.4) / 0.8;
  const labAfterCurve = {
    l: applyCurve(labAfterLch.l, curveL),
    a: applyCurve(normA, curveA) * 0.8 - 0.4,
    b: applyCurve(normB, curveB) * 0.8 - 0.4
  };

  return enforceGamut(oklabToRgbUnclamped(labAfterCurve), settings.gamutPolicy).rgb;
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

function isGradientPaint(paint: Paint): paint is GradientPaint {
  return isGradientPaintType(paint.type);
}

function getExistingGradientPaint(fills: ReadonlyArray<Paint>): GradientPaint | undefined {
  return fills.find((paint): paint is GradientPaint => isGradientPaint(paint));
}

function getGradientTransformForNode(fills: ReadonlyArray<Paint>): Transform {
  const existingGradient = getExistingGradientPaint(fills);
  if (existingGradient?.gradientTransform) {
    return existingGradient.gradientTransform;
  }

  return [[1, 0, 0], [0, 1, 0]];
}

function replaceOrPrependPaint(
  fills: ReadonlyArray<Paint>,
  nextPaint: Paint,
  replaceIndex: number
): Paint[] {
  return replaceAtOrPrepend(fills, replaceIndex, nextPaint);
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "request-selection-color") {
    figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
  }

  if (msg.type === "apply-solid-adjustment") {
    const settings = msg.settings as SolidAdjustmentSettings;
    let updatedNodes = 0;

    for (const node of figma.currentPage.selection) {
      if (!("fills" in node)) continue;

      const fills = node.fills as ReadonlyArray<Paint>;
      const sourceSolid = fills.find((paint) => paint.type === "SOLID") as SolidPaint | undefined;
      const baseColor = sourceSolid?.color ?? { r: 0.5, g: 0.5, b: 0.5 };

      const nextSolid: SolidPaint = {
        type: "SOLID",
        visible: sourceSolid?.visible ?? true,
        opacity: sourceSolid?.opacity ?? 1,
        blendMode: sourceSolid?.blendMode ?? "NORMAL",
        color: applySolidAdjustment(baseColor, settings)
      };

      const next = replaceOrPrependPaint(
        fills,
        nextSolid,
        fills.findIndex((paint) => paint.type === "SOLID")
      );

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

      const sourceGradient = getExistingGradientPaint(fills);
      const nextGradient: GradientPaint = {
        type: sourceGradient?.type ?? "GRADIENT_LINEAR",
        visible: sourceGradient?.visible ?? true,
        opacity: sourceGradient?.opacity ?? 1,
        blendMode: sourceGradient?.blendMode ?? "NORMAL",
        gradientTransform: getGradientTransformForNode(fills),
        gradientStops
      };

      const next = replaceOrPrependPaint(
        fills,
        nextGradient,
        findGradientOrSolidReplaceIndex(fills)
      );

      try {
        node.fills = next;
        updatedNodes += 1;
      } catch {
        // Some nodes expose readonly paints at runtime; skip them.
      }
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
