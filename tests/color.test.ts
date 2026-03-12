import { describe, it, expect } from "vitest";
import {
  rgbToOklab,
  oklabToRgb,
  oklabToOklch,
  oklchToOklab,
  rgbToOklch,
  oklchToRgb,
  mixOklch,
  monotoneCubic,
  applyCurves,
  gradientRamp,
  enforceGamut,
  applyExposure,
  applyContrast,
  applyHighlights,
  applyShadows,
  applySaturation,
  applyVibrance,
  applyTemperature,
  applyHueShift,
  applyHueBandAdjustment,
  applySplitToning,
  applyColorGrading,
  applyAllAdjustments,
  defaultAdjustments,
} from "../src/color";

// ── Conversions ────────────────────────────────────────────

describe("color conversions", () => {
  it("round-trips RGB → OkLab → RGB", () => {
    const rgb = { r: 0.2, g: 0.5, b: 0.7 };
    const out = oklabToRgb(rgbToOklab(rgb));
    expect(out.r).toBeCloseTo(rgb.r, 2);
    expect(out.g).toBeCloseTo(rgb.g, 2);
    expect(out.b).toBeCloseTo(rgb.b, 2);
  });

  it("round-trips OkLab ↔ OkLch", () => {
    const lab = { l: 0.7, a: 0.11, b: -0.05 };
    const out = oklchToOklab(oklabToOklch(lab));
    expect(out.l).toBeCloseTo(lab.l, 6);
    expect(out.a).toBeCloseTo(lab.a, 6);
    expect(out.b).toBeCloseTo(lab.b, 6);
  });

  it("round-trips RGB → OkLch → RGB", () => {
    const rgb = { r: 0.8, g: 0.3, b: 0.1 };
    const out = oklchToRgb(rgbToOklch(rgb));
    expect(out.r).toBeCloseTo(rgb.r, 2);
    expect(out.g).toBeCloseTo(rgb.g, 2);
    expect(out.b).toBeCloseTo(rgb.b, 2);
  });

  it("mixes hue on shortest path across 350→10°", () => {
    const a = { l: 0.6, c: 0.1, h: 350 };
    const b = { l: 0.6, c: 0.1, h: 10 };
    const m = mixOklch(a, b, 0.5);
    // Midpoint should be at 0° (= 360°), not 180°
    expect(m.h === 0 || m.h === 360).toBeTruthy();
  });

  it("pure black maps to L=0 in OkLab", () => {
    const lab = rgbToOklab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 4);
    expect(Math.abs(lab.a)).toBeLessThan(0.001);
    expect(Math.abs(lab.b)).toBeLessThan(0.001);
  });

  it("pure white maps to L=1 in OkLab", () => {
    const lab = rgbToOklab({ r: 1, g: 1, b: 1 });
    expect(lab.l).toBeCloseTo(1, 4);
  });
});

// ── Monotone curve ─────────────────────────────────────────

describe("monotone cubic interpolation", () => {
  it("identity line returns input", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(monotoneCubic(pts, 0.5)).toBeCloseTo(0.5, 3);
    expect(monotoneCubic(pts, 0.0)).toBeCloseTo(0.0, 3);
    expect(monotoneCubic(pts, 1.0)).toBeCloseTo(1.0, 3);
  });

  it("clamps output to endpoints outside range", () => {
    const pts = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.9 }];
    expect(monotoneCubic(pts, 0.0)).toBe(0.1);
    expect(monotoneCubic(pts, 1.0)).toBe(0.9);
  });

  it("passes exactly through control points", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.8 },
      { x: 1, y: 1 },
    ];
    expect(monotoneCubic(pts, 0)).toBeCloseTo(0, 4);
    expect(monotoneCubic(pts, 0.5)).toBeCloseTo(0.8, 4);
    expect(monotoneCubic(pts, 1)).toBeCloseTo(1, 4);
  });

  it("is monotone for S-curve", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.1 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 1 },
    ];
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const y = monotoneCubic(pts, i / 20);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = y;
    }
  });
});

// ── Tone adjustments ───────────────────────────────────────

describe("tone adjustments", () => {
  const mid = { r: 0.5, g: 0.5, b: 0.5 };

  it("exposure +1 stop roughly doubles brightness", () => {
    const out = applyExposure(mid, 1);
    expect(out.r).toBeGreaterThan(mid.r);
    expect(out.g).toBeGreaterThan(mid.g);
  });

  it("exposure -1 stop halves brightness", () => {
    const out = applyExposure(mid, -1);
    expect(out.r).toBeLessThan(mid.r);
  });

  it("contrast +50 increases contrast (brights brighter, darks darker)", () => {
    const bright = applyContrast({ r: 0.8, g: 0.8, b: 0.8 }, 50);
    const dark = applyContrast({ r: 0.2, g: 0.2, b: 0.2 }, 50);
    expect(bright.r).toBeGreaterThan(0.8);
    expect(dark.r).toBeLessThan(0.2);
  });

  it("highlights +100 brightens highlights only", () => {
    const highlight = applyHighlights({ r: 0.9, g: 0.9, b: 0.9 }, 100);
    const shadow = applyHighlights({ r: 0.1, g: 0.1, b: 0.1 }, 100);
    expect(highlight.r).toBeGreaterThan(0.9);
    // Shadows should not be significantly affected
    expect(shadow.r).toBeCloseTo(0.1, 1);
  });

  it("shadows +100 brightens shadows only", () => {
    const shadow = applyShadows({ r: 0.1, g: 0.1, b: 0.1 }, 100);
    const highlight = applyShadows({ r: 0.9, g: 0.9, b: 0.9 }, 100);
    expect(shadow.r).toBeGreaterThan(0.1);
    expect(highlight.r).toBeCloseTo(0.9, 1);
  });

  it("keeps output in 0–1 range for extreme values", () => {
    const cases: Array<[typeof mid, number]> = [
      [{ r: 0, g: 0, b: 0 }, 5],
      [{ r: 1, g: 1, b: 1 }, -5],
      [mid, 100],
    ];
    for (const [rgb, stops] of cases) {
      const out = applyExposure(rgb, stops);
      expect(out.r).toBeGreaterThanOrEqual(0);
      expect(out.r).toBeLessThanOrEqual(1);
    }
  });
});

// ── Color adjustments ──────────────────────────────────────

describe("color adjustments", () => {
  const red = { r: 0.8, g: 0.1, b: 0.1 };

  it("saturation 0 produces gray", () => {
    const gray = applySaturation({ r: 0.5, g: 0.3, b: 0.7 }, -100);
    expect(gray.r).toBeCloseTo(gray.g, 2);
    expect(gray.g).toBeCloseTo(gray.b, 2);
  });

  it("saturation +100 increases chroma", () => {
    const orig = rgbToOklch(red);
    const sat = rgbToOklch(applySaturation(red, 100));
    expect(sat.c).toBeGreaterThan(orig.c);
  });

  it("hue shift 180° roughly inverts hue", () => {
    const orig = rgbToOklch(red);
    const shifted = rgbToOklch(applyHueShift(red, 180));
    let diff = Math.abs(shifted.h - orig.h);
    if (diff > 180) diff = 360 - diff;
    expect(diff).toBeCloseTo(180, 0);
  });

  it("temperature warm shift increases b channel", () => {
    const origLab = rgbToOklab(red);
    const warmLab = rgbToOklab(applyTemperature(red, 100));
    expect(warmLab.b).toBeGreaterThan(origLab.b);
  });

  it("vibrance protects already-saturated colors", () => {
    // Highly saturated red should not gain much chroma
    const highSat = { r: 1, g: 0, b: 0 };
    const origC = rgbToOklch(highSat).c;
    const vibC = rgbToOklch(applyVibrance(highSat, 100)).c;
    // Should not increase by more than 0.02
    expect(vibC - origC).toBeLessThan(0.02);
  });
});

// ── HSL Mixer ──────────────────────────────────────────────

describe("HSL mixer", () => {
  it("red band adjustment only affects reds", () => {
    const redColor = { r: 0.9, g: 0.1, b: 0.1 };
    const blueColor = { r: 0.1, g: 0.1, b: 0.9 };

    const adjRed = { band: "red" as const, hue: 30, saturation: 0, luminance: 0 };
    const newRed = applyHueBandAdjustment(redColor, adjRed);
    const newBlue = applyHueBandAdjustment(blueColor, adjRed);

    // Red should change hue significantly
    const redHueDiff = Math.abs(rgbToOklch(newRed).h - rgbToOklch(redColor).h);
    // Blue should barely change
    const blueHueDiff = Math.abs(rgbToOklch(newBlue).h - rgbToOklch(blueColor).h);
    expect(redHueDiff).toBeGreaterThan(blueHueDiff + 5);
  });

  it("achromatic colors are unaffected by HSL mixer", () => {
    const gray = { r: 0.5, g: 0.5, b: 0.5 };
    const adj = { band: "red" as const, hue: 90, saturation: 100, luminance: 50 };
    const out = applyHueBandAdjustment(gray, adj);
    expect(out.r).toBeCloseTo(gray.r, 2);
  });
});

// ── Curves ────────────────────────────────────────────────

describe("applyCurves", () => {
  const defaultCurves = {
    l: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    c: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    h: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  };

  it("identity curves return original color", () => {
    const rgb = { r: 0.4, g: 0.6, b: 0.8 };
    const out = applyCurves(rgb, defaultCurves);
    expect(out.r).toBeCloseTo(rgb.r, 2);
    expect(out.g).toBeCloseTo(rgb.g, 2);
    expect(out.b).toBeCloseTo(rgb.b, 2);
  });

  it("L curve boost increases lightness", () => {
    const rgb = { r: 0.5, g: 0.5, b: 0.5 };
    const curves = {
      ...defaultCurves,
      l: [{ x: 0, y: 0 }, { x: 0.5, y: 0.75 }, { x: 1, y: 1 }],
    };
    const out = applyCurves(rgb, curves);
    // Midtone should be brighter
    const origL = rgbToOklab(rgb).l;
    const outL = rgbToOklab(out).l;
    expect(outL).toBeGreaterThan(origL);
  });

  it("output stays in 0–1 gamut", () => {
    const rgb = { r: 0.3, g: 0.6, b: 0.9 };
    const extremeCurve = {
      ...defaultCurves,
      l: [{ x: 0, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 1, y: 1 }],
    };
    const out = applyCurves(rgb, extremeCurve);
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(1);
    expect(out.g).toBeGreaterThanOrEqual(0);
    expect(out.b).toBeLessThanOrEqual(1);
  });
});

// ── Grade ──────────────────────────────────────────────────

describe("split toning", () => {
  it("shadow toning shifts dark pixels toward target hue", () => {
    const dark = { r: 0.1, g: 0.1, b: 0.1 };
    const params = {
      shadowHue: 220,
      shadowSat: 80,
      highlightHue: 40,
      highlightSat: 0,
      balance: 0,
    };
    const out = rgbToOklab(applySplitToning(dark, params));
    // Blue shadow: b should be more negative (blueish)
    const orig = rgbToOklab(dark);
    expect(Math.abs(out.a - orig.a) + Math.abs(out.b - orig.b)).toBeGreaterThan(0.001);
  });

  it("zero saturation has no effect", () => {
    const rgb = { r: 0.5, g: 0.3, b: 0.7 };
    const params = { shadowHue: 180, shadowSat: 0, highlightHue: 60, highlightSat: 0, balance: 0 };
    const out = applySplitToning(rgb, params);
    expect(out.r).toBeCloseTo(rgb.r, 4);
    expect(out.g).toBeCloseTo(rgb.g, 4);
  });
});

describe("color grading", () => {
  it("lift L offset affects shadows more than highlights", () => {
    const shadow = { r: 0.1, g: 0.1, b: 0.1 };
    const highlight = { r: 0.9, g: 0.9, b: 0.9 };
    const params = {
      lift: { l: 50, hue: 0, chroma: 0 },
      gamma: { l: 0, hue: 0, chroma: 0 },
      gain: { l: 0, hue: 0, chroma: 0 },
    };
    const shadowBefore = rgbToOklab(shadow).l;
    const highlightBefore = rgbToOklab(highlight).l;
    const shadowAfter = rgbToOklab(applyColorGrading(shadow, params)).l;
    const highlightAfter = rgbToOklab(applyColorGrading(highlight, params)).l;

    const shadowDelta = shadowAfter - shadowBefore;
    const highlightDelta = highlightAfter - highlightBefore;
    expect(shadowDelta).toBeGreaterThan(highlightDelta);
  });
});

// ── Full pipeline ──────────────────────────────────────────

describe("applyAllAdjustments", () => {
  it("default adjustments are identity", () => {
    const rgb = { r: 0.3, g: 0.6, b: 0.9 };
    const out = applyAllAdjustments(rgb, defaultAdjustments());
    expect(out.r).toBeCloseTo(rgb.r, 3);
    expect(out.g).toBeCloseTo(rgb.g, 3);
    expect(out.b).toBeCloseTo(rgb.b, 3);
  });

  it("output is always in 0–1 range", () => {
    const cases: RGB[] = [
      { r: 0, g: 0, b: 0 },
      { r: 1, g: 1, b: 1 },
      { r: 0.5, g: 0.3, b: 0.7 },
      { r: 0.9, g: 0.1, b: 0.1 },
    ];
    const adj = {
      ...defaultAdjustments(),
      exposure: 3,
      contrast: 80,
      saturation: 60,
    };
    for (const rgb of cases) {
      const out = applyAllAdjustments(rgb, adj);
      expect(out.r).toBeGreaterThanOrEqual(0);
      expect(out.r).toBeLessThanOrEqual(1);
      expect(out.g).toBeGreaterThanOrEqual(0);
      expect(out.g).toBeLessThanOrEqual(1);
      expect(out.b).toBeGreaterThanOrEqual(0);
      expect(out.b).toBeLessThanOrEqual(1);
    }
  });

  it("invert produces complementary color", () => {
    const rgb = { r: 0.2, g: 0.5, b: 0.8 };
    const out = applyAllAdjustments(rgb, { ...defaultAdjustments(), invert: true });
    expect(out.r).toBeCloseTo(1 - rgb.r, 3);
    expect(out.g).toBeCloseTo(1 - rgb.g, 3);
    expect(out.b).toBeCloseTo(1 - rgb.b, 3);
  });

  it("monochrome produces neutral gray", () => {
    const rgb = { r: 0.9, g: 0.3, b: 0.1 };
    const out = applyAllAdjustments(rgb, { ...defaultAdjustments(), monochrome: true });
    expect(out.r).toBeCloseTo(out.g, 3);
    expect(out.g).toBeCloseTo(out.b, 3);
  });
});

// ── Gradient & gamut ───────────────────────────────────────

describe("gradient and gamut", () => {
  it("builds OkLch gradient ramp with requested steps", () => {
    const ramp = gradientRamp({ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }, 12);
    expect(ramp.length).toBe(12);
  });

  it("ramp endpoints match inputs approximately", () => {
    const start = { r: 0.8, g: 0.2, b: 0.2 };
    const end = { r: 0.2, g: 0.2, b: 0.8 };
    const ramp = gradientRamp(start, end, 10);
    expect(ramp[0].r).toBeCloseTo(start.r, 2);
    expect(ramp[9].b).toBeCloseTo(end.b, 2);
  });

  it("clips gamut overflow", () => {
    const out = enforceGamut({ r: 1.2, g: -0.1, b: 0.5 }, "clip");
    expect(out.clipped).toBeTruthy();
    expect(out.rgb.r).toBe(1);
    expect(out.rgb.g).toBe(0);
    expect(out.rgb.b).toBe(0.5);
  });

  it("compresses gamut overflow", () => {
    const out = enforceGamut({ r: 1.2, g: 0.8, b: 0.6 }, "compress");
    expect(out.clipped).toBeTruthy();
    expect(out.rgb.r).toBeLessThanOrEqual(1);
    expect(out.rgb.g).toBeLessThanOrEqual(1);
    expect(out.rgb.b).toBeLessThanOrEqual(1);
  });

  it("in-gamut colors are not clipped", () => {
    const out = enforceGamut({ r: 0.5, g: 0.5, b: 0.5 }, "clip");
    expect(out.clipped).toBeFalsy();
  });
});
