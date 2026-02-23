import { describe, it, expect } from "vitest";
import {
  rgbToOklab,
  oklabToRgb,
  oklabToRgbUnclamped,
  oklabToOklch,
  oklchToOklab,
  mixOklch,
  applyCurve,
  applyLabCurves,
  gradientRamp,
  gradientRampFromStops,
  enforceGamut,
  getCurvePreset,
  computeRegionMaskWeight
} from "../src/color";

describe("okcolor conversion", () => {
  it("round-trips rgb -> oklab -> rgb", () => {
    const rgb = { r: 0.2, g: 0.5, b: 0.7 };
    const out = oklabToRgb(rgbToOklab(rgb));
    expect(Math.abs(out.r - rgb.r)).toBeLessThan(0.01);
    expect(Math.abs(out.g - rgb.g)).toBeLessThan(0.01);
    expect(Math.abs(out.b - rgb.b)).toBeLessThan(0.01);
  });

  it("round-trips oklab <-> oklch", () => {
    const lab = { l: 0.7, a: 0.11, b: -0.05 };
    const out = oklchToOklab(oklabToOklch(lab));
    expect(Math.abs(out.l - lab.l)).toBeLessThan(1e-6);
    expect(Math.abs(out.a - lab.a)).toBeLessThan(1e-6);
    expect(Math.abs(out.b - lab.b)).toBeLessThan(1e-6);
  });

  it("mixes hue on shortest path", () => {
    const a = { l: 0.6, c: 0.1, h: 350 };
    const b = { l: 0.6, c: 0.1, h: 10 };
    const m = mixOklch(a, b, 0.5);
    expect(m.h === 0 || m.h === 360).toBeTruthy();
  });
});

describe("curve ops", () => {
  it("applies linear interpolation", () => {
    const y = applyCurve(0.25, [
      { x: 0, y: 0 },
      { x: 0.5, y: 1 },
      { x: 1, y: 1 }
    ]);
    expect(y).toBeCloseTo(0.5, 2);
  });

  it("applies lab curve and keeps rgb range", () => {
    const out = applyLabCurves(
      { r: 0.4, g: 0.4, b: 0.4 },
      { l: [{ x: 0, y: 0.1 }, { x: 1, y: 1 }] }
    );
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.g).toBeGreaterThanOrEqual(0);
    expect(out.b).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(1);
    expect(out.g).toBeLessThanOrEqual(1);
    expect(out.b).toBeLessThanOrEqual(1);
  });

  it("provides curve presets as copied points", () => {
    const contrast = getCurvePreset("contrast");
    contrast[0].y = 0.99;
    const contrastAgain = getCurvePreset("contrast");
    expect(contrastAgain[0].y).toBe(0);
    expect(contrastAgain.length).toBeGreaterThanOrEqual(4);
  });
});

describe("gradient and gamut", () => {
  it("builds oklch gradient ramp with requested steps", () => {
    const ramp = gradientRamp({ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }, 12);
    expect(ramp.length).toBe(12);
  });

  it("builds a multi-stop oklch ramp", () => {
    const ramp = gradientRampFromStops([
      { position: 0, color: { r: 1, g: 0, b: 0 } },
      { position: 0.4, color: { r: 0, g: 1, b: 0 } },
      { position: 1, color: { r: 0, g: 0, b: 1 } }
    ], 15);

    expect(ramp.length).toBe(15);
    expect(ramp[0].r).toBeCloseTo(1, 2);
    expect(ramp[ramp.length - 1].b).toBeCloseTo(1, 2);
  });

  it("detects out-of-gamut before enforcing policy", () => {
    const raw = oklabToRgbUnclamped({ l: 0.8, a: 0.45, b: -0.2 });
    expect(raw.r > 1 || raw.r < 0 || raw.g > 1 || raw.g < 0 || raw.b > 1 || raw.b < 0).toBeTruthy();
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

  it("computes region mask weight from l/c ranges", () => {
    const full = computeRegionMaskWeight(
      { l: 0.6, c: 0.12, h: 20 },
      { lMin: 0.2, lMax: 0.9, cMin: 0.05, cMax: 0.2, feather: 0.05 }
    );
    const outside = computeRegionMaskWeight(
      { l: 0.1, c: 0.12, h: 20 },
      { lMin: 0.2, lMax: 0.9, cMin: 0.05, cMax: 0.2, feather: 0.05 }
    );
    const feathered = computeRegionMaskWeight(
      { l: 0.22, c: 0.06, h: 20 },
      { lMin: 0.2, lMax: 0.9, cMin: 0.05, cMax: 0.2, feather: 0.05 }
    );

    expect(full).toBeCloseTo(1, 3);
    expect(outside).toBe(0);
    expect(feathered).toBeGreaterThan(0);
    expect(feathered).toBeLessThan(1);
  });
});
