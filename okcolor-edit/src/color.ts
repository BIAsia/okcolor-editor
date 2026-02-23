export type RGB = { r: number; g: number; b: number };
export type Oklab = { l: number; a: number; b: number };
export type Oklch = { l: number; c: number; h: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const deg2rad = (d: number) => (d * Math.PI) / 180;
const rad2deg = (r: number) => (r * 180) / Math.PI;

function srgbToLinear(v: number): number {
  const c = clamp01(v);
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
}

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
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  };
}

export function oklabToRgbUnclamped(lab: Oklab): RGB {
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

export function oklabToRgb(lab: Oklab): RGB {
  const raw = oklabToRgbUnclamped(lab);
  return {
    r: clamp01(raw.r),
    g: clamp01(raw.g),
    b: clamp01(raw.b)
  };
}

export function oklabToOklch(lab: Oklab): Oklch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = rad2deg(Math.atan2(lab.b, lab.a));
  if (h < 0) h += 360;
  return { l: lab.l, c, h };
}

export function oklchToOklab(lch: Oklch): Oklab {
  const hr = deg2rad(lch.h);
  return {
    l: lch.l,
    a: lch.c * Math.cos(hr),
    b: lch.c * Math.sin(hr)
  };
}

export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  const x = Math.min(1, Math.max(0, t));
  const dh = ((((b.h - a.h) % 360) + 540) % 360) - 180;
  return {
    l: a.l + (b.l - a.l) * x,
    c: a.c + (b.c - a.c) * x,
    h: (a.h + dh * x + 360) % 360
  };
}

export function adjustInOklab(
  rgb: RGB,
  delta: Partial<{ l: number; a: number; b: number }>
): RGB {
  const lab = rgbToOklab(rgb);
  return oklabToRgb({
    l: lab.l + (delta.l ?? 0),
    a: lab.a + (delta.a ?? 0),
    b: lab.b + (delta.b ?? 0)
  });
}

export function adjustInOklch(
  rgb: RGB,
  delta: Partial<{ l: number; c: number; h: number }>
): RGB {
  const lch = oklabToOklch(rgbToOklab(rgb));
  return oklabToRgb(
    oklchToOklab({
      l: lch.l + (delta.l ?? 0),
      c: Math.max(0, lch.c + (delta.c ?? 0)),
      h: (lch.h + (delta.h ?? 0) + 360) % 360
    })
  );
}

export type CurvePoint = { x: number; y: number };

export type CurvePresetId = "custom" | "contrast" | "filmic" | "pastel-recover";

const CURVE_PRESETS: Record<Exclude<CurvePresetId, "custom">, CurvePoint[]> = {
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

export function getCurvePreset(id: Exclude<CurvePresetId, "custom">): CurvePoint[] {
  return CURVE_PRESETS[id].map((point) => ({ ...point }));
}

export function applyCurve(value: number, points: CurvePoint[]): number {
  const x = clamp01(value);
  const sorted = [...points].sort((p, q) => p.x - q.x);
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

export function applyLabCurves(
  rgb: RGB,
  curves: Partial<{ l: CurvePoint[]; a: CurvePoint[]; b: CurvePoint[] }>
): RGB {
  const lab = rgbToOklab(rgb);
  const normA = (lab.a + 0.4) / 0.8;
  const normB = (lab.b + 0.4) / 0.8;
  const nextL = curves.l ? applyCurve(lab.l, curves.l) : lab.l;
  const nextA = curves.a ? applyCurve(normA, curves.a) * 0.8 - 0.4 : lab.a;
  const nextB = curves.b ? applyCurve(normB, curves.b) * 0.8 - 0.4 : lab.b;
  return oklabToRgb({ l: nextL, a: nextA, b: nextB });
}

export type GamutPolicy = "clip" | "compress" | "warn";

export function isInGamut(rgb: RGB): boolean {
  return rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1;
}

export function enforceGamut(rgb: RGB, policy: GamutPolicy): { rgb: RGB; clipped: boolean } {
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

export type RegionMask = {
  lMin: number;
  lMax: number;
  cMin: number;
  cMax: number;
  feather: number;
};

function edgeWeight(value: number, min: number, max: number, feather: number): number {
  if (value < min || value > max) return 0;
  if (feather <= 1e-6) return 1;
  const fromMin = (value - min) / feather;
  const toMax = (max - value) / feather;
  return clamp01(Math.min(fromMin, toMax, 1));
}

export function computeRegionMaskWeight(lch: Oklch, mask: RegionMask): number {
  const lWeight = edgeWeight(lch.l, clamp01(mask.lMin), clamp01(mask.lMax), Math.max(0, mask.feather));
  const cWeight = edgeWeight(lch.c, Math.max(0, mask.cMin), Math.max(0, mask.cMax), Math.max(0, mask.feather));
  return lWeight * cWeight;
}

export function gradientRamp(start: RGB, end: RGB, steps: number): RGB[] {
  const a = oklabToOklch(rgbToOklab(start));
  const b = oklabToOklch(rgbToOklab(end));
  const count = Math.max(2, Math.floor(steps));
  const out: RGB[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    out.push(oklabToRgb(oklchToOklab(mixOklch(a, b, t))));
  }
  return out;
}

export type GradientStop = {
  position: number;
  color: RGB;
};

export function gradientRampFromStops(stops: GradientStop[], steps: number): RGB[] {
  const count = Math.max(2, Math.floor(steps));
  const normalizedStops = [...stops]
    .map((stop) => ({
      position: clamp01(stop.position),
      color: stop.color
    }))
    .sort((left, right) => left.position - right.position);

  if (normalizedStops.length < 2) {
    const fallback = normalizedStops[0]?.color ?? { r: 0, g: 0, b: 0 };
    return Array.from({ length: count }, () => ({ ...fallback }));
  }

  const lchStops = normalizedStops.map((stop) => ({
    position: stop.position,
    lch: oklabToOklch(rgbToOklab(stop.color))
  }));

  const out: RGB[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);

    let rightIndex = lchStops.findIndex((stop) => t <= stop.position);
    if (rightIndex <= 0) rightIndex = 1;
    if (rightIndex === -1) rightIndex = lchStops.length - 1;

    const left = lchStops[rightIndex - 1];
    const right = lchStops[rightIndex];
    const segmentSpan = Math.max(1e-6, right.position - left.position);
    const localT = clamp01((t - left.position) / segmentSpan);
    out.push(oklabToRgb(oklchToOklab(mixOklch(left.lch, right.lch, localT))));
  }

  return out;
}
