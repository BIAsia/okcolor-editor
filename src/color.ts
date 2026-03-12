// ============================================================
// Types
// ============================================================

export type RGB = { r: number; g: number; b: number };
export type Oklab = { l: number; a: number; b: number };
export type Oklch = { l: number; c: number; h: number };
export type CurvePoint = { x: number; y: number };

export type HueBand =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "purple"
  | "magenta";

export const HUE_BANDS: HueBand[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "aqua",
  "blue",
  "purple",
  "magenta",
];

// Approximate OkLch hue centers for each color band
const HUE_CENTERS: Record<HueBand, number> = {
  red: 27,
  orange: 60,
  yellow: 100,
  green: 148,
  aqua: 200,
  blue: 260,
  purple: 305,
  magenta: 345,
};

const HUE_WIDTHS: Record<HueBand, number> = {
  red: 30,
  orange: 28,
  yellow: 28,
  green: 38,
  aqua: 38,
  blue: 38,
  purple: 35,
  magenta: 30,
};

export interface HueBandAdjustment {
  band: HueBand;
  hue: number;        // -100 to +100
  saturation: number; // -100 to +100
  luminance: number;  // -100 to +100
}

export interface SplitToningParams {
  shadowHue: number;    // 0–360
  shadowSat: number;    // 0–100
  highlightHue: number; // 0–360
  highlightSat: number; // 0–100
  balance: number;      // -100 to +100
}

export interface ColorGradingWheel {
  l: number;      // -100 to +100 (luminance offset)
  hue: number;    // 0–360
  chroma: number; // 0–100
}

export interface ColorGradingParams {
  lift: ColorGradingWheel;  // Shadows
  gamma: ColorGradingWheel; // Midtones
  gain: ColorGradingWheel;  // Highlights
}

export interface CurveChannels {
  l: CurvePoint[]; // OkLab Lightness (0–1)
  c: CurvePoint[]; // OkLch Chroma normalized (0–1)
  h: CurvePoint[]; // Hue remap (input: H/360, output: H/360)
}

export interface Adjustments {
  // ── Tone ──────────────────────
  exposure: number;   // -5 to +5 (EV stops)
  contrast: number;   // -100 to +100
  highlights: number; // -100 to +100
  shadows: number;    // -100 to +100
  whites: number;     // -100 to +100
  blacks: number;     // -100 to +100
  clarity: number;    // -100 to +100

  // ── Color ─────────────────────
  temperature: number; // -100 to +100 (cool → warm)
  tint: number;        // -100 to +100 (green → magenta)
  hueShift: number;    // -180 to +180
  saturation: number;  // -100 to +100
  vibrance: number;    // -100 to +100
  invert: boolean;
  monochrome: boolean;
  monoR: number; // 0–200 (default 100)
  monoG: number;
  monoB: number;

  // ── HSL Mixer ─────────────────
  hslMixer: HueBandAdjustment[];

  // ── Curves ────────────────────
  curves: CurveChannels;

  // ── Grade ─────────────────────
  splitToning: SplitToningParams;
  colorGrading: ColorGradingParams;
}

export function defaultAdjustments(): Adjustments {
  return {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    clarity: 0,
    temperature: 0,
    tint: 0,
    hueShift: 0,
    saturation: 0,
    vibrance: 0,
    invert: false,
    monochrome: false,
    monoR: 100,
    monoG: 100,
    monoB: 100,
    hslMixer: HUE_BANDS.map((band) => ({
      band,
      hue: 0,
      saturation: 0,
      luminance: 0,
    })),
    curves: {
      l: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      c: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      h: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    },
    splitToning: {
      shadowHue: 220,
      shadowSat: 0,
      highlightHue: 40,
      highlightSat: 0,
      balance: 0,
    },
    colorGrading: {
      lift: { l: 0, hue: 0, chroma: 0 },
      gamma: { l: 0, hue: 0, chroma: 0 },
      gain: { l: 0, hue: 0, chroma: 0 },
    },
  };
}

// ============================================================
// Math helpers
// ============================================================

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

// ============================================================
// sRGB ↔ Linear
// ============================================================

export function srgbToLinear(v: number): number {
  const c = clamp01(v);
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v: number): number {
  const c = Math.max(0, v);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ============================================================
// RGB ↔ OkLab
// ============================================================

export function rgbToOklab(rgb: RGB): Oklab {
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
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb(lab: Oklab): RGB {
  const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
}

// ============================================================
// OkLab ↔ OkLch
// ============================================================

export function oklabToOklch(lab: Oklab): Oklch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.l, c, h };
}

export function oklchToOklab(lch: Oklch): Oklab {
  const hr = deg2rad(lch.h);
  return { l: lch.l, a: lch.c * Math.cos(hr), b: lch.c * Math.sin(hr) };
}

export const rgbToOklch = (rgb: RGB): Oklch => oklabToOklch(rgbToOklab(rgb));
export const oklchToRgb = (lch: Oklch): RGB => oklabToRgb(oklchToOklab(lch));

// ============================================================
// Monotone Cubic Interpolation (Steffen 1990)
// Guarantees smooth, non-oscillating curves between control points
// ============================================================

export function monotoneCubic(points: CurvePoint[], x: number): number {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;

  if (n === 0) return x;
  if (n === 1) return pts[0].y;
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[n - 1].x) return pts[n - 1].y;

  // Build intervals
  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1].x - pts[i].x;
    s[i] = (pts[i + 1].y - pts[i].y) / Math.max(h[i], 1e-10);
  }

  // Compute slopes using Steffen's method
  const m = new Array<number>(n);
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) {
      m[i] = 0;
    } else {
      const p = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i]);
      m[i] =
        Math.sign(p) *
        Math.min(Math.abs(p), 2 * Math.abs(s[i - 1]), 2 * Math.abs(s[i]));
    }
  }

  // Find enclosing segment
  let idx = 0;
  while (idx < n - 2 && pts[idx + 1].x < x) idx++;

  const t = (x - pts[idx].x) / h[idx];
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    pts[idx].y * (2 * t3 - 3 * t2 + 1) +
    m[idx] * h[idx] * (t3 - 2 * t2 + t) +
    pts[idx + 1].y * (3 * t2 - 2 * t3) +
    m[idx + 1] * h[idx] * (t3 - t2)
  );
}

// ============================================================
// Luminance masks for range-selective adjustments
// ============================================================

function maskHighlights(L: number): number {
  return clamp01((L - 0.4) / 0.4);
}

function maskShadows(L: number): number {
  return clamp01(1 - L / 0.5);
}

function maskMidtones(L: number): number {
  const x = (L - 0.5) * 2;
  return clamp01(1 - x * x);
}

function maskWhites(L: number): number {
  return clamp01((L - 0.6) / 0.3);
}

function maskBlacks(L: number): number {
  return clamp01(1 - L / 0.3);
}

// ============================================================
// Individual Adjustment Functions
// ============================================================

/** Exposure: operates in linear light, +1 stop = 2× brightness */
export function applyExposure(rgb: RGB, stops: number): RGB {
  const f = Math.pow(2, stops);
  return {
    r: clamp01(linearToSrgb(srgbToLinear(rgb.r) * f)),
    g: clamp01(linearToSrgb(srgbToLinear(rgb.g) * f)),
    b: clamp01(linearToSrgb(srgbToLinear(rgb.b) * f)),
  };
}

/** Contrast: S-curve pivoted at L=0.5 */
export function applyContrast(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const k = 1 + amount / 100;
  return oklabToRgb({ ...lab, l: clamp01(0.5 + (lab.l - 0.5) * k) });
}

/** Highlights: brighten/darken bright areas */
export function applyHighlights(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const delta = (amount / 100) * 0.35 * maskHighlights(lab.l);
  return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}

/** Shadows: brighten/darken dark areas */
export function applyShadows(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const delta = (amount / 100) * 0.35 * maskShadows(lab.l);
  return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}

/** Whites: shift the white point */
export function applyWhites(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const delta = (amount / 100) * 0.25 * maskWhites(lab.l);
  return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}

/** Blacks: shift the black point */
export function applyBlacks(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const delta = (amount / 100) * 0.25 * maskBlacks(lab.l);
  return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}

/** Clarity: midtone contrast (per-pixel approximation) */
export function applyClarity(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const mask = maskMidtones(lab.l);
  const k = 1 + (amount / 100) * 0.6 * mask;
  return oklabToRgb({ ...lab, l: clamp01(0.5 + (lab.l - 0.5) * k) });
}

/** Temperature: warm (+) / cool (-) via OkLab b+a axes */
export function applyTemperature(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  const t = amount / 100;
  return oklabToRgb({ ...lab, a: lab.a + t * 0.025, b: lab.b + t * 0.075 });
}

/** Tint: green (-) / magenta (+) via OkLab a axis */
export function applyTint(rgb: RGB, amount: number): RGB {
  const lab = rgbToOklab(rgb);
  return oklabToRgb({ ...lab, a: lab.a + (amount / 100) * 0.05 });
}

/** Hue Shift: rotate all hues in OkLch */
export function applyHueShift(rgb: RGB, degrees: number): RGB {
  const lch = rgbToOklch(rgb);
  return oklchToRgb({ ...lch, h: (lch.h + degrees + 360) % 360 });
}

/** Saturation: linear chroma scaling */
export function applySaturation(rgb: RGB, amount: number): RGB {
  const lch = rgbToOklch(rgb);
  const f = Math.max(0, 1 + amount / 100);
  return oklchToRgb({ ...lch, c: lch.c * f });
}

/** Vibrance: smart saturation – less effect on vivid or skin-tone pixels */
export function applyVibrance(rgb: RGB, amount: number): RGB {
  const lch = rgbToOklch(rgb);
  const maxC = 0.38;
  const satLevel = clamp01(lch.c / maxC);

  // Skin-tone protection around hue ~30°
  const skinDist = Math.abs(
    Math.atan2(
      Math.sin(deg2rad(lch.h - 30)),
      Math.cos(deg2rad(lch.h - 30))
    )
  );
  const skinProtect = clamp01(1 - skinDist / deg2rad(35));

  const weight = (1 - satLevel) * (1 - skinProtect * 0.6);
  const delta = (amount / 100) * 0.18 * weight;
  return oklchToRgb({ ...lch, c: Math.max(0, lch.c + delta) });
}

/** Invert colors */
export function applyInvert(rgb: RGB): RGB {
  return { r: 1 - rgb.r, g: 1 - rgb.g, b: 1 - rgb.b };
}

/** Monochrome: weighted channel mixing */
export function applyMonochrome(
  rgb: RGB,
  rW: number,
  gW: number,
  bW: number
): RGB {
  const total = rW + gW + bW;
  const nr = total > 0 ? rW / total : 1 / 3;
  const ng = total > 0 ? gW / total : 1 / 3;
  const nb = total > 0 ? bW / total : 1 / 3;
  const gray = clamp01(rgb.r * nr + rgb.g * ng + rgb.b * nb);
  return { r: gray, g: gray, b: gray };
}

// ============================================================
// HSL Mixer – per-hue-band adjustment
// ============================================================

function hueBandWeight(
  pixelHue: number,
  centerHue: number,
  width: number
): number {
  let dist = Math.abs(pixelHue - centerHue);
  if (dist > 180) dist = 360 - dist;
  const sigma = width / 2;
  return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

export function applyHueBandAdjustment(
  rgb: RGB,
  adj: HueBandAdjustment
): RGB {
  const lch = rgbToOklch(rgb);
  if (lch.c < 0.008) return rgb; // achromatic – skip

  const center = HUE_CENTERS[adj.band];
  const width = HUE_WIDTHS[adj.band];
  const w = hueBandWeight(lch.h, center, width);
  if (w < 0.002) return rgb;

  const hDelta = (adj.hue / 100) * 30 * w;
  const cFactor = 1 + (adj.saturation / 100) * w;
  const lDelta = (adj.luminance / 100) * 0.18 * w;

  return oklchToRgb({
    l: clamp01(lch.l + lDelta),
    c: Math.max(0, lch.c * cFactor),
    h: (lch.h + hDelta + 360) % 360,
  });
}

// ============================================================
// Tone Curves
// ============================================================

const C_MAX = 0.4; // Approximate max OkLch chroma

export function applyCurves(rgb: RGB, curves: CurveChannels): RGB {
  const lab = rgbToOklab(rgb);
  const newL = clamp01(monotoneCubic(curves.l, lab.l));

  const lch = oklabToOklch({ ...lab, l: newL });
  const cNorm = clamp01(lch.c / C_MAX);
  const newC = clamp01(monotoneCubic(curves.c, cNorm)) * C_MAX;

  const hNorm = lch.h / 360;
  const newH = (clamp01(monotoneCubic(curves.h, hNorm)) * 360 + 360) % 360;

  return oklchToRgb({ l: newL, c: newC, h: newH });
}

// ============================================================
// Split Toning
// ============================================================

export function applySplitToning(
  rgb: RGB,
  params: SplitToningParams
): RGB {
  const lch = rgbToOklch(rgb);
  const midpoint = clamp(0.5 + params.balance / 200, 0.01, 0.99);

  const shadowW =
    clamp01(1 - lch.l / midpoint) * (params.shadowSat / 100);
  const highlightW =
    clamp01((lch.l - midpoint) / (1 - midpoint)) * (params.highlightSat / 100);

  if (shadowW < 0.001 && highlightW < 0.001) return rgb;

  const maxToneC = 0.12;
  const sRad = deg2rad(params.shadowHue);
  const hRad = deg2rad(params.highlightHue);

  const lab = rgbToOklab(rgb);
  const targetA =
    shadowW * maxToneC * Math.cos(sRad) +
    highlightW * maxToneC * Math.cos(hRad);
  const targetB =
    shadowW * maxToneC * Math.sin(sRad) +
    highlightW * maxToneC * Math.sin(hRad);

  const blend = clamp01(shadowW + highlightW) * 0.65;

  return oklabToRgb({
    l: lab.l,
    a: lab.a * (1 - blend) + targetA * blend,
    b: lab.b * (1 - blend) + targetB * blend,
  });
}

// ============================================================
// 3-Way Color Grading (Lift / Gamma / Gain)
// ============================================================

export function applyColorGrading(
  rgb: RGB,
  params: ColorGradingParams
): RGB {
  const lab = rgbToOklab(rgb);
  const L = lab.l;

  const liftMask = Math.pow(1 - L, 1.5);
  const gammaMask = maskMidtones(L);
  const gainMask = Math.pow(L, 1.5);

  const tA = (w: ColorGradingWheel, mask: number) =>
    (w.chroma / 100) * 0.1 * Math.cos(deg2rad(w.hue)) * mask;
  const tB = (w: ColorGradingWheel, mask: number) =>
    (w.chroma / 100) * 0.1 * Math.sin(deg2rad(w.hue)) * mask;
  const tL = (w: ColorGradingWheel, mask: number) =>
    (w.l / 100) * 0.2 * mask;

  return oklabToRgb({
    l: clamp01(
      lab.l +
        tL(params.lift, liftMask) +
        tL(params.gamma, gammaMask) +
        tL(params.gain, gainMask)
    ),
    a:
      lab.a +
      tA(params.lift, liftMask) +
      tA(params.gamma, gammaMask) +
      tA(params.gain, gainMask),
    b:
      lab.b +
      tB(params.lift, liftMask) +
      tB(params.gamma, gammaMask) +
      tB(params.gain, gainMask),
  });
}

// ============================================================
// Master pipeline: apply all adjustments in sequence
// ============================================================

export function applyAllAdjustments(rgb: RGB, adj: Adjustments): RGB {
  let c = rgb;

  if (adj.invert) c = applyInvert(c);
  if (adj.monochrome) c = applyMonochrome(c, adj.monoR, adj.monoG, adj.monoB);

  // Tone
  if (adj.exposure !== 0) c = applyExposure(c, adj.exposure);
  if (adj.contrast !== 0) c = applyContrast(c, adj.contrast);
  if (adj.highlights !== 0) c = applyHighlights(c, adj.highlights);
  if (adj.shadows !== 0) c = applyShadows(c, adj.shadows);
  if (adj.whites !== 0) c = applyWhites(c, adj.whites);
  if (adj.blacks !== 0) c = applyBlacks(c, adj.blacks);
  if (adj.clarity !== 0) c = applyClarity(c, adj.clarity);

  // Color
  if (adj.temperature !== 0) c = applyTemperature(c, adj.temperature);
  if (adj.tint !== 0) c = applyTint(c, adj.tint);
  if (adj.hueShift !== 0) c = applyHueShift(c, adj.hueShift);
  if (adj.saturation !== 0) c = applySaturation(c, adj.saturation);
  if (adj.vibrance !== 0) c = applyVibrance(c, adj.vibrance);

  // HSL Mixer
  for (const band of adj.hslMixer) {
    if (band.hue !== 0 || band.saturation !== 0 || band.luminance !== 0) {
      c = applyHueBandAdjustment(c, band);
    }
  }

  // Curves (skip if identity)
  const isIdentityLine = (pts: CurvePoint[]) =>
    pts.length === 2 &&
    pts[0].x === 0 && pts[0].y === 0 &&
    pts[1].x === 1 && pts[1].y === 1;
  if (
    !isIdentityLine(adj.curves.l) ||
    !isIdentityLine(adj.curves.c) ||
    !isIdentityLine(adj.curves.h)
  ) {
    c = applyCurves(c, adj.curves);
  }

  // Grade
  if (adj.splitToning.shadowSat > 0 || adj.splitToning.highlightSat > 0) {
    c = applySplitToning(c, adj.splitToning);
  }

  const { lift, gamma, gain } = adj.colorGrading;
  if (
    lift.l !== 0 || lift.chroma !== 0 ||
    gamma.l !== 0 || gamma.chroma !== 0 ||
    gain.l !== 0 || gain.chroma !== 0
  ) {
    c = applyColorGrading(c, adj.colorGrading);
  }

  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b) };
}

// ============================================================
// OkLch gradient ramp
// ============================================================

export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  const dh = (((b.h - a.h) % 360) + 540) % 360 - 180;
  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: (a.h + dh * t + 360) % 360,
  };
}

export function gradientRamp(start: RGB, end: RGB, steps: number): RGB[] {
  const a = rgbToOklch(start);
  const b = rgbToOklch(end);
  const count = Math.max(2, Math.floor(steps));
  return Array.from({ length: count }, (_, i) =>
    oklchToRgb(mixOklch(a, b, i / (count - 1)))
  );
}

// ============================================================
// Gamut utilities
// ============================================================

export function isInGamut(rgb: RGB): boolean {
  return (
    rgb.r >= 0 && rgb.r <= 1 &&
    rgb.g >= 0 && rgb.g <= 1 &&
    rgb.b >= 0 && rgb.b <= 1
  );
}

export type GamutPolicy = "clip" | "compress";

export function enforceGamut(
  rgb: RGB,
  policy: GamutPolicy = "clip"
): { rgb: RGB; clipped: boolean } {
  const clipped = !isInGamut(rgb);
  if (!clipped) return { rgb, clipped: false };

  if (policy === "compress") {
    const scale = Math.max(rgb.r, rgb.g, rgb.b, 1);
    return {
      rgb: {
        r: clamp01(rgb.r / scale),
        g: clamp01(rgb.g / scale),
        b: clamp01(rgb.b / scale),
      },
      clipped,
    };
  }

  return {
    rgb: { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) },
    clipped,
  };
}
