"use strict";
(() => {
  // src/color.ts
  var clamp01 = (v) => Math.min(1, Math.max(0, v));
  var deg2rad = (d) => d * Math.PI / 180;
  var rad2deg = (r) => r * 180 / Math.PI;
  function srgbToLinear(v) {
    const c = clamp01(v);
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(v) {
    return v <= 31308e-7 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  }
  function rgbToOklab(rgb) {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    return {
      l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
    };
  }
  function oklabToRgbUnclamped(lab) {
    const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const s_ = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return {
      r: linearToSrgb(rLin),
      g: linearToSrgb(gLin),
      b: linearToSrgb(bLin)
    };
  }
  function oklabToOklch(lab) {
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = rad2deg(Math.atan2(lab.b, lab.a));
    if (h < 0) h += 360;
    return { l: lab.l, c, h };
  }
  function oklchToOklab(lch) {
    const hr = deg2rad(lch.h);
    return {
      l: lch.l,
      a: lch.c * Math.cos(hr),
      b: lch.c * Math.sin(hr)
    };
  }
  var CURVE_PRESETS = {
    contrast: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.18 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.84 },
      { x: 1, y: 1 }
    ],
    filmic: [
      { x: 0, y: 0.05 },
      { x: 0.2, y: 0.18 },
      { x: 0.5, y: 0.55 },
      { x: 0.85, y: 0.92 },
      { x: 1, y: 0.98 }
    ],
    "pastel-recover": [
      { x: 0, y: 0 },
      { x: 0.35, y: 0.42 },
      { x: 0.65, y: 0.72 },
      { x: 1, y: 0.95 }
    ]
  };
  function getCurvePreset(id) {
    return CURVE_PRESETS[id].map((point) => Object.assign({}, point));
  }
  function applyCurve(value, points) {
    const x = clamp01(value);
    const sorted = points.slice().sort((p, q) => p.x - q.x);
    if (sorted.length === 0) return x;
    if (x <= sorted[0].x) return clamp01(sorted[0].y);
    for (let i = 1; i < sorted.length; i++) {
      const p0 = sorted[i - 1];
      const p1 = sorted[i];
      if (x <= p1.x) {
        const t = (x - p0.x) / Math.max(1e-6, p1.x - p0.x);
        return clamp01(p0.y + (p1.y - p0.y) * t);
      }
    }
    return clamp01(sorted[sorted.length - 1].y);
  }
  function isInGamut(rgb) {
    return rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1;
  }
  function enforceGamut(rgb, policy) {
    const clipped = !isInGamut(rgb);
    if (policy === "warn") {
      return {
        rgb: { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) },
        clipped
      };
    }
    if (policy === "clip") {
      return {
        rgb: { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) },
        clipped
      };
    }
    const scale = Math.max(rgb.r, rgb.g, rgb.b, 1);
    return {
      rgb: {
        r: clamp01(rgb.r / scale),
        g: clamp01(rgb.g / scale),
        b: clamp01(rgb.b / scale)
      },
      clipped
    };
  }
  function edgeWeight(value, min, max, feather) {
    if (value < min || value > max) return 0;
    if (feather <= 1e-6) return 1;
    const fromMin = (value - min) / feather;
    const toMax = (max - value) / feather;
    return clamp01(Math.min(fromMin, toMax, 1));
  }
  function computeRegionMaskWeight(lch, mask) {
    const lWeight = edgeWeight(lch.l, clamp01(mask.lMin), clamp01(mask.lMax), Math.max(0, mask.feather));
    const cWeight = edgeWeight(lch.c, Math.max(0, mask.cMin), Math.max(0, mask.cMax), Math.max(0, mask.feather));
    return lWeight * cWeight;
  }

  // src/paint-utils.ts
  function isGradientPaintType(type) {
    return type === "GRADIENT_LINEAR" || type === "GRADIENT_RADIAL" || type === "GRADIENT_ANGULAR" || type === "GRADIENT_DIAMOND";
  }
  function findGradientOrSolidReplaceIndex(fills) {
    const gradientIndex = fills.findIndex((paint) => isGradientPaintType(paint.type));
    if (gradientIndex >= 0) return gradientIndex;
    return fills.findIndex((paint) => paint.type === "SOLID");
  }
  function replaceAtOrPrepend(items, index, nextItem) {
    if (index >= 0 && index < items.length) {
      return items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
    }
    return [nextItem].concat(items);
  }
  function formatApplyPaintNotification(actionLabel, stats) {
    const { updatedNodes, skippedNoFills, skippedReadonly } = stats;
    const skippedTotal = skippedNoFills + skippedReadonly;
    if (updatedNodes > 0) {
      const base = `Applied ${actionLabel} to ${updatedNodes} layer${updatedNodes > 1 ? "s" : ""}`;
      if (skippedTotal === 0) {
        return { message: base, error: false };
      }
      const details = [];
      if (skippedNoFills > 0) details.push(`${skippedNoFills} without fills`);
      if (skippedReadonly > 0) details.push(`${skippedReadonly} readonly`);
      return { message: `${base} (skipped ${skippedTotal}: ${details.join(", ")})`, error: false };
    }
    if (skippedNoFills > 0 || skippedReadonly > 0) {
      const details = [];
      if (skippedNoFills > 0) details.push(`${skippedNoFills} without fills`);
      if (skippedReadonly > 0) details.push(`${skippedReadonly} readonly`);
      return { message: `No editable selection (${details.join(", ")})`, error: true };
    }
    return { message: "No selected layers with editable fills", error: true };
  }

  // src/code.ts
  figma.showUI(__html__, { width: 360, height: 520 });
  function getSolidPaintColor() {
    const nodeWithFills = figma.currentPage.selection.find(
      (node) => "fills" in node
    );
    if (!nodeWithFills) return null;
    const fills = nodeWithFills.fills;
    const solid = fills.find((p) => p.type === "SOLID");
    return solid ? solid.color : null;
  }
  function getLumaCurve(settings) {
    if (settings.curvePreset === "custom") {
      return [
        { x: 0, y: 0 },
        { x: 0.5, y: settings.curveMid },
        { x: 1, y: 1 }
      ];
    }
    return getCurvePreset(settings.curvePreset);
  }
  function getAxisCurve(mid) {
    return [
      { x: 0, y: 0 },
      { x: 0.5, y: mid },
      { x: 1, y: 1 }
    ];
  }
  function applySolidAdjustment(base, settings) {
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
  function sanitizeGradientStops(stops) {
    const normalized = (stops != null ? stops : []).map((stop) => ({
      position: Math.min(1, Math.max(0, Number(stop.position))),
      color: stop.color
    })).filter(
      (stop) => Number.isFinite(stop.position) && stop.color && Number.isFinite(stop.color.r) && Number.isFinite(stop.color.g) && Number.isFinite(stop.color.b)
    ).sort((left, right) => left.position - right.position);
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
  function isGradientPaint(paint) {
    return isGradientPaintType(paint.type);
  }
  function getExistingGradientPaint(fills) {
    return fills.find((paint) => isGradientPaint(paint));
  }
  function getGradientTransformForNode(fills) {
    const existingGradient = getExistingGradientPaint(fills);
    if (existingGradient == null ? void 0 : existingGradient.gradientTransform) {
      return existingGradient.gradientTransform;
    }
    return [[1, 0, 0], [0, 1, 0]];
  }
  function replaceOrPrependPaint(fills, nextPaint, replaceIndex) {
    return replaceAtOrPrepend(fills, replaceIndex, nextPaint);
  }
  figma.ui.onmessage = (msg) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (msg.type === "request-selection-color") {
      figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
    }
    if (msg.type === "apply-solid-adjustment") {
      const settings = msg.settings;
      let updatedNodes = 0;
      let skippedNoFills = 0;
      let skippedReadonly = 0;
      for (const node of figma.currentPage.selection) {
        if (!("fills" in node)) {
          skippedNoFills += 1;
          continue;
        }
        const fills = node.fills;
        const sourceSolid = fills.find((paint) => paint.type === "SOLID");
        const baseColor = (_a = sourceSolid == null ? void 0 : sourceSolid.color) != null ? _a : { r: 0.5, g: 0.5, b: 0.5 };
        const nextSolid = {
          type: "SOLID",
          visible: (_b = sourceSolid == null ? void 0 : sourceSolid.visible) != null ? _b : true,
          opacity: (_c = sourceSolid == null ? void 0 : sourceSolid.opacity) != null ? _c : 1,
          blendMode: (_d = sourceSolid == null ? void 0 : sourceSolid.blendMode) != null ? _d : "NORMAL",
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
        } catch (e) {
          skippedReadonly += 1;
        }
      }
      const notification = formatApplyPaintNotification("OKColor edit", {
        updatedNodes,
        skippedNoFills,
        skippedReadonly
      });
      figma.notify(notification.message, notification.error ? { error: true } : void 0);
    }
    if (msg.type === "apply-gradient") {
      const gradientStops = sanitizeGradientStops(msg.stops);
      let updatedNodes = 0;
      let skippedNoFills = 0;
      let skippedReadonly = 0;
      for (const node of figma.currentPage.selection) {
        if (!("fills" in node)) {
          skippedNoFills += 1;
          continue;
        }
        const fills = node.fills;
        const sourceGradient = getExistingGradientPaint(fills);
        const nextGradient = {
          type: (_e = sourceGradient == null ? void 0 : sourceGradient.type) != null ? _e : "GRADIENT_LINEAR",
          visible: (_f = sourceGradient == null ? void 0 : sourceGradient.visible) != null ? _f : true,
          opacity: (_g = sourceGradient == null ? void 0 : sourceGradient.opacity) != null ? _g : 1,
          blendMode: (_h = sourceGradient == null ? void 0 : sourceGradient.blendMode) != null ? _h : "NORMAL",
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
        } catch (e) {
          skippedReadonly += 1;
        }
      }
      const notification = formatApplyPaintNotification("gradient", {
        updatedNodes,
        skippedNoFills,
        skippedReadonly
      });
      figma.notify(notification.message, notification.error ? { error: true } : void 0);
    }
    if (msg.type === "close") {
      figma.closePlugin();
    }
  };
})();
