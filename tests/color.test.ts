import { describe, it, expect } from "vitest";
import {
  rgbToOklab,
  oklabToRgb,
  oklabToOklch,
  oklchToOklab,
  mixOklch,
  applyCurve,
  applyLabCurves,
  gradientRamp,
  enforceGamut
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
});

describe("gradient and gamut", () => {
  it("builds oklch gradient ramp with requested steps", () => {
    const ramp = gradientRamp({ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }, 12);
    expect(ramp.length).toBe(12);
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
});
