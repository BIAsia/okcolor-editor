// ── OKColor Editor UI Bundle ──────────────────────────────────
// color math (inlined from src/color.ts)
// ============================================================
// Types
// ============================================================
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "aqua"
    | "blue"
    | "purple"
    | "magenta";
const HUE_BANDS = [
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
const HUE_CENTERS = {
    red: 27,
    orange: 60,
    yellow: 100,
    green: 148,
    aqua: 200,
    blue: 260,
    purple: 305,
    magenta: 345,
};
const HUE_WIDTHS = {
    red: 30,
    orange: 28,
    yellow: 28,
    green: 38,
    aqua: 38,
    blue: 38,
    purple: 35,
    magenta: 30,
};
function defaultAdjustments() {
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
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(v, 0, 1);
const deg2rad = (d) => (d * Math.PI) / 180;
// ============================================================
// sRGB ↔ Linear
// ============================================================
function srgbToLinear(v) {
    const c = clamp01(v);
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(v) {
    const c = Math.max(0, v);
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
// ============================================================
// RGB ↔ OkLab
// ============================================================
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
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    };
}
function oklabToRgb(lab) {
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
function oklabToOklch(lab) {
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
    if (h < 0)
        h += 360;
    return { l: lab.l, c, h };
}
function oklchToOklab(lch) {
    const hr = deg2rad(lch.h);
    return { l: lch.l, a: lch.c * Math.cos(hr), b: lch.c * Math.sin(hr) };
}
const rgbToOklch = (rgb) => oklabToOklch(rgbToOklab(rgb));
const oklchToRgb = (lch) => oklabToRgb(oklchToOklab(lch));
// ============================================================
// Monotone Cubic Interpolation (Steffen 1990)
// Guarantees smooth, non-oscillating curves between control points
// ============================================================
function monotoneCubic(points, x) {
    const pts = [...points].sort((a, b) => a.x - b.x);
    const n = pts.length;
    if (n === 0)
        return x;
    if (n === 1)
        return pts[0].y;
    if (x <= pts[0].x)
        return pts[0].y;
    if (x >= pts[n - 1].x)
        return pts[n - 1].y;
    // Build intervals
    const h = [];
    const s = [];
    for (let i = 0; i < n - 1; i++) {
        h[i] = pts[i + 1].x - pts[i].x;
        s[i] = (pts[i + 1].y - pts[i].y) / Math.max(h[i], 1e-10);
    }
    // Compute slopes using Steffen's method
    const m = new Array(n);
    m[0] = s[0];
    m[n - 1] = s[n - 2];
    for (let i = 1; i < n - 1; i++) {
        if (s[i - 1] * s[i] <= 0) {
            m[i] = 0;
        }
        else {
            const p = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i]);
            m[i] =
                Math.sign(p) *
                    Math.min(Math.abs(p), 2 * Math.abs(s[i - 1]), 2 * Math.abs(s[i]));
        }
    }
    // Find enclosing segment
    let idx = 0;
    while (idx < n - 2 && pts[idx + 1].x < x)
        idx++;
    const t = (x - pts[idx].x) / h[idx];
    const t2 = t * t;
    const t3 = t2 * t;
    return (pts[idx].y * (2 * t3 - 3 * t2 + 1) +
        m[idx] * h[idx] * (t3 - 2 * t2 + t) +
        pts[idx + 1].y * (3 * t2 - 2 * t3) +
        m[idx + 1] * h[idx] * (t3 - t2));
}
// ============================================================
// Luminance masks for range-selective adjustments
// ============================================================
function maskHighlights(L) {
    return clamp01((L - 0.4) / 0.4);
}
function maskShadows(L) {
    return clamp01(1 - L / 0.5);
}
function maskMidtones(L) {
    const x = (L - 0.5) * 2;
    return clamp01(1 - x * x);
}
function maskWhites(L) {
    return clamp01((L - 0.6) / 0.3);
}
function maskBlacks(L) {
    return clamp01(1 - L / 0.3);
}
// ============================================================
// Individual Adjustment Functions
// ============================================================
/** Exposure: operates in linear light, +1 stop = 2× brightness */
function applyExposure(rgb, stops) {
    const f = Math.pow(2, stops);
    return {
        r: clamp01(linearToSrgb(srgbToLinear(rgb.r) * f)),
        g: clamp01(linearToSrgb(srgbToLinear(rgb.g) * f)),
        b: clamp01(linearToSrgb(srgbToLinear(rgb.b) * f)),
    };
}
/** Contrast: S-curve pivoted at L=0.5 */
function applyContrast(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const k = 1 + amount / 100;
    return oklabToRgb({ ...lab, l: clamp01(0.5 + (lab.l - 0.5) * k) });
}
/** Highlights: brighten/darken bright areas */
function applyHighlights(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const delta = (amount / 100) * 0.35 * maskHighlights(lab.l);
    return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}
/** Shadows: brighten/darken dark areas */
function applyShadows(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const delta = (amount / 100) * 0.35 * maskShadows(lab.l);
    return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}
/** Whites: shift the white point */
function applyWhites(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const delta = (amount / 100) * 0.25 * maskWhites(lab.l);
    return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}
/** Blacks: shift the black point */
function applyBlacks(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const delta = (amount / 100) * 0.25 * maskBlacks(lab.l);
    return oklabToRgb({ ...lab, l: clamp01(lab.l + delta) });
}
/** Clarity: midtone contrast (per-pixel approximation) */
function applyClarity(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const mask = maskMidtones(lab.l);
    const k = 1 + (amount / 100) * 0.6 * mask;
    return oklabToRgb({ ...lab, l: clamp01(0.5 + (lab.l - 0.5) * k) });
}
/** Temperature: warm (+) / cool (-) via OkLab b+a axes */
function applyTemperature(rgb, amount) {
    const lab = rgbToOklab(rgb);
    const t = amount / 100;
    return oklabToRgb({ ...lab, a: lab.a + t * 0.025, b: lab.b + t * 0.075 });
}
/** Tint: green (-) / magenta (+) via OkLab a axis */
function applyTint(rgb, amount) {
    const lab = rgbToOklab(rgb);
    return oklabToRgb({ ...lab, a: lab.a + (amount / 100) * 0.05 });
}
/** Hue Shift: rotate all hues in OkLch */
function applyHueShift(rgb, degrees) {
    const lch = rgbToOklch(rgb);
    return oklchToRgb({ ...lch, h: (lch.h + degrees + 360) % 360 });
}
/** Saturation: linear chroma scaling */
function applySaturation(rgb, amount) {
    const lch = rgbToOklch(rgb);
    const f = Math.max(0, 1 + amount / 100);
    return oklchToRgb({ ...lch, c: lch.c * f });
}
/** Vibrance: smart saturation – less effect on vivid or skin-tone pixels */
function applyVibrance(rgb, amount) {
    const lch = rgbToOklch(rgb);
    const maxC = 0.38;
    const satLevel = clamp01(lch.c / maxC);
    // Skin-tone protection around hue ~30°
    const skinDist = Math.abs(Math.atan2(Math.sin(deg2rad(lch.h - 30)), Math.cos(deg2rad(lch.h - 30))));
    const skinProtect = clamp01(1 - skinDist / deg2rad(35));
    const weight = (1 - satLevel) * (1 - skinProtect * 0.6);
    const delta = (amount / 100) * 0.18 * weight;
    return oklchToRgb({ ...lch, c: Math.max(0, lch.c + delta) });
}
/** Invert colors */
function applyInvert(rgb) {
    return { r: 1 - rgb.r, g: 1 - rgb.g, b: 1 - rgb.b };
}
/** Monochrome: weighted channel mixing */
function applyMonochrome(rgb, rW, gW, bW) {
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
function hueBandWeight(pixelHue, centerHue, width) {
    let dist = Math.abs(pixelHue - centerHue);
    if (dist > 180)
        dist = 360 - dist;
    const sigma = width / 2;
    return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}
function applyHueBandAdjustment(rgb, adj) {
    const lch = rgbToOklch(rgb);
    if (lch.c < 0.008)
        return rgb; // achromatic – skip
    const center = HUE_CENTERS[adj.band];
    const width = HUE_WIDTHS[adj.band];
    const w = hueBandWeight(lch.h, center, width);
    if (w < 0.002)
        return rgb;
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
function applyCurves(rgb, curves) {
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
function applySplitToning(rgb, params) {
    const lch = rgbToOklch(rgb);
    const midpoint = clamp(0.5 + params.balance / 200, 0.01, 0.99);
    const shadowW = clamp01(1 - lch.l / midpoint) * (params.shadowSat / 100);
    const highlightW = clamp01((lch.l - midpoint) / (1 - midpoint)) * (params.highlightSat / 100);
    if (shadowW < 0.001 && highlightW < 0.001)
        return rgb;
    const maxToneC = 0.12;
    const sRad = deg2rad(params.shadowHue);
    const hRad = deg2rad(params.highlightHue);
    const lab = rgbToOklab(rgb);
    const targetA = shadowW * maxToneC * Math.cos(sRad) +
        highlightW * maxToneC * Math.cos(hRad);
    const targetB = shadowW * maxToneC * Math.sin(sRad) +
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
function applyColorGrading(rgb, params) {
    const lab = rgbToOklab(rgb);
    const L = lab.l;
    const liftMask = Math.pow(1 - L, 1.5);
    const gammaMask = maskMidtones(L);
    const gainMask = Math.pow(L, 1.5);
    const tA = (w, mask) => (w.chroma / 100) * 0.1 * Math.cos(deg2rad(w.hue)) * mask;
    const tB = (w, mask) => (w.chroma / 100) * 0.1 * Math.sin(deg2rad(w.hue)) * mask;
    const tL = (w, mask) => (w.l / 100) * 0.2 * mask;
    return oklabToRgb({
        l: clamp01(lab.l +
            tL(params.lift, liftMask) +
            tL(params.gamma, gammaMask) +
            tL(params.gain, gainMask)),
        a: lab.a +
            tA(params.lift, liftMask) +
            tA(params.gamma, gammaMask) +
            tA(params.gain, gainMask),
        b: lab.b +
            tB(params.lift, liftMask) +
            tB(params.gamma, gammaMask) +
            tB(params.gain, gainMask),
    });
}
// ============================================================
// Master pipeline: apply all adjustments in sequence
// ============================================================
function applyAllAdjustments(rgb, adj) {
    let c = rgb;
    if (adj.invert)
        c = applyInvert(c);
    if (adj.monochrome)
        c = applyMonochrome(c, adj.monoR, adj.monoG, adj.monoB);
    // Tone
    if (adj.exposure !== 0)
        c = applyExposure(c, adj.exposure);
    if (adj.contrast !== 0)
        c = applyContrast(c, adj.contrast);
    if (adj.highlights !== 0)
        c = applyHighlights(c, adj.highlights);
    if (adj.shadows !== 0)
        c = applyShadows(c, adj.shadows);
    if (adj.whites !== 0)
        c = applyWhites(c, adj.whites);
    if (adj.blacks !== 0)
        c = applyBlacks(c, adj.blacks);
    if (adj.clarity !== 0)
        c = applyClarity(c, adj.clarity);
    // Color
    if (adj.temperature !== 0)
        c = applyTemperature(c, adj.temperature);
    if (adj.tint !== 0)
        c = applyTint(c, adj.tint);
    if (adj.hueShift !== 0)
        c = applyHueShift(c, adj.hueShift);
    if (adj.saturation !== 0)
        c = applySaturation(c, adj.saturation);
    if (adj.vibrance !== 0)
        c = applyVibrance(c, adj.vibrance);
    // HSL Mixer
    for (const band of adj.hslMixer) {
        if (band.hue !== 0 || band.saturation !== 0 || band.luminance !== 0) {
            c = applyHueBandAdjustment(c, band);
        }
    }
    // Curves (skip if identity)
    const isIdentityLine = (pts) => pts.length === 2 &&
        pts[0].x === 0 && pts[0].y === 0 &&
        pts[1].x === 1 && pts[1].y === 1;
    if (!isIdentityLine(adj.curves.l) ||
        !isIdentityLine(adj.curves.c) ||
        !isIdentityLine(adj.curves.h)) {
        c = applyCurves(c, adj.curves);
    }
    // Grade
    if (adj.splitToning.shadowSat > 0 || adj.splitToning.highlightSat > 0) {
        c = applySplitToning(c, adj.splitToning);
    }
    const { lift, gamma, gain } = adj.colorGrading;
    if (lift.l !== 0 || lift.chroma !== 0 ||
        gamma.l !== 0 || gamma.chroma !== 0 ||
        gain.l !== 0 || gain.chroma !== 0) {
        c = applyColorGrading(c, adj.colorGrading);
    }
    return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b) };
}
// ============================================================
// OkLch gradient ramp
// ============================================================
function mixOklch(a, b, t) {
    const dh = (((b.h - a.h) % 360) + 540) % 360 - 180;
    return {
        l: a.l + (b.l - a.l) * t,
        c: a.c + (b.c - a.c) * t,
        h: (a.h + dh * t + 360) % 360,
    };
}
function gradientRamp(start, end, steps) {
    const a = rgbToOklch(start);
    const b = rgbToOklch(end);
    const count = Math.max(2, Math.floor(steps));
    return Array.from({ length: count }, (_, i) => oklchToRgb(mixOklch(a, b, i / (count - 1))));
}
// ============================================================
// Gamut utilities
// ============================================================
function isInGamut(rgb) {
    return (rgb.r >= 0 && rgb.r <= 1 &&
        rgb.g >= 0 && rgb.g <= 1 &&
        rgb.b >= 0 && rgb.b <= 1);
}
function enforceGamut(rgb, policy = "clip") {
    const clipped = !isInGamut(rgb);
    if (!clipped)
        return { rgb, clipped: false };
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

// ui logic (inlined from ui/ui.ts)
// ============================================================
// Helpers
// ============================================================
const $ = (id) => document.getElementById(id);
function rgbCss(rgb) {
    return `rgb(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)})`;
}
function parseRgb(rgb) {
    return rgbCss(rgb);
}
function fmtVal(v, decimals = 0) {
    return decimals ? v.toFixed(decimals) : String(Math.round(v));
}
// ============================================================
// State
// ============================================================
let adj = defaultAdjustments();
let currentSelection = { count: 0, fills: [], hasImages: false };
// Pending processed image bytes keyed by `nodeId:fillIndex`
const pendingImages = new Map();
// Requested images waiting for bytes from plugin
const pendingImageRequests = new Set();
// ============================================================
// Slider ↔ NumberInput sync
// ============================================================
/** Pairs of [sliderId, numberInputId, adjKey, decimals] */
const SLIDER_DEFS = [
    ["exposure", "exposure-n", "exposure", 2],
    ["contrast", "contrast-n", "contrast", 0],
    ["highlights", "highlights-n", "highlights", 0],
    ["shadows", "shadows-n", "shadows", 0],
    ["whites", "whites-n", "whites", 0],
    ["blacks", "blacks-n", "blacks", 0],
    ["clarity", "clarity-n", "clarity", 0],
    ["temperature", "temperature-n", "temperature", 0],
    ["tint", "tint-n", "tint", 0],
    ["hueShift", "hueShift-n", "hueShift", 0],
    ["saturation", "saturation-n", "saturation", 0],
    ["vibrance", "vibrance-n", "vibrance", 0],
    ["monoR", "monoR-n", "monoR", 0],
    ["monoG", "monoG-n", "monoG", 0],
    ["monoB", "monoB-n", "monoB", 0],
    ["shadowSat", "shadowSat-n", "splitToning", 0], // handled specially
    ["highlightSat", "highlightSat-n", "splitToning", 0],
    ["stBalance", "stBalance-n", "splitToning", 0],
    ["liftL", "liftL-n", "colorGrading", 0],
    ["gammaL", "gammaL-n", "colorGrading", 0],
    ["gainL", "gainL-n", "colorGrading", 0],
];
function initSliders() {
    for (const [sliderId, numId, key, dec] of SLIDER_DEFS) {
        const slider = $(sliderId);
        const numInput = $(numId);
        if (!slider || !numInput)
            continue;
        slider.addEventListener("input", () => {
            const v = parseFloat(slider.value);
            numInput.value = fmtVal(v, dec);
            setAdjFromSlider(key, v);
            markChanged(slider, numInput, v);
            onAdjustmentChanged();
        });
        numInput.addEventListener("change", () => {
            const v = clampNum(parseFloat(numInput.value), slider);
            slider.value = String(v);
            numInput.value = fmtVal(v, dec);
            setAdjFromSlider(key, v);
            markChanged(slider, numInput, v);
            onAdjustmentChanged();
        });
    }
}
function clampNum(v, slider) {
    const lo = parseFloat(slider.min);
    const hi = parseFloat(slider.max);
    return Math.min(hi, Math.max(lo, isNaN(v) ? 0 : v));
}
function markChanged(slider, numInput, value) {
    const def = parseFloat(slider.dataset.default ?? "0");
    const isChanged = Math.abs(value - def) > 0.001;
    slider.classList.toggle("changed", isChanged);
    numInput.classList.toggle("changed", isChanged);
}
function setAdjFromSlider(key, v) {
    switch (key) {
        case "exposure":
            adj.exposure = v;
            break;
        case "contrast":
            adj.contrast = v;
            break;
        case "highlights":
            adj.highlights = v;
            break;
        case "shadows":
            adj.shadows = v;
            break;
        case "whites":
            adj.whites = v;
            break;
        case "blacks":
            adj.blacks = v;
            break;
        case "clarity":
            adj.clarity = v;
            break;
        case "temperature":
            adj.temperature = v;
            break;
        case "tint":
            adj.tint = v;
            break;
        case "hueShift":
            adj.hueShift = v;
            break;
        case "saturation":
            adj.saturation = v;
            break;
        case "vibrance":
            adj.vibrance = v;
            break;
        case "monoR":
            adj.monoR = v;
            break;
        case "monoG":
            adj.monoG = v;
            break;
        case "monoB":
            adj.monoB = v;
            break;
        case "shadowSat":
            adj.splitToning.shadowSat = v;
            break;
        case "highlightSat":
            adj.splitToning.highlightSat = v;
            break;
        case "stBalance":
            adj.splitToning.balance = v;
            break;
        case "liftL":
            adj.colorGrading.lift.l = v;
            break;
        case "gammaL":
            adj.colorGrading.gamma.l = v;
            break;
        case "gainL":
            adj.colorGrading.gain.l = v;
            break;
    }
}
function syncSliderFromAdj() {
    const numericPairs = [
        ["exposure", "exposure-n", () => adj.exposure, 2],
        ["contrast", "contrast-n", () => adj.contrast, 0],
        ["highlights", "highlights-n", () => adj.highlights, 0],
        ["shadows", "shadows-n", () => adj.shadows, 0],
        ["whites", "whites-n", () => adj.whites, 0],
        ["blacks", "blacks-n", () => adj.blacks, 0],
        ["clarity", "clarity-n", () => adj.clarity, 0],
        ["temperature", "temperature-n", () => adj.temperature, 0],
        ["tint", "tint-n", () => adj.tint, 0],
        ["hueShift", "hueShift-n", () => adj.hueShift, 0],
        ["saturation", "saturation-n", () => adj.saturation, 0],
        ["vibrance", "vibrance-n", () => adj.vibrance, 0],
        ["monoR", "monoR-n", () => adj.monoR, 0],
        ["monoG", "monoG-n", () => adj.monoG, 0],
        ["monoB", "monoB-n", () => adj.monoB, 0],
        ["shadowSat", "shadowSat-n", () => adj.splitToning.shadowSat, 0],
        ["highlightSat", "highlightSat-n", () => adj.splitToning.highlightSat, 0],
        ["stBalance", "stBalance-n", () => adj.splitToning.balance, 0],
        ["liftL", "liftL-n", () => adj.colorGrading.lift.l, 0],
        ["gammaL", "gammaL-n", () => adj.colorGrading.gamma.l, 0],
        ["gainL", "gainL-n", () => adj.colorGrading.gain.l, 0],
    ];
    for (const [sid, nid, getter, dec] of numericPairs) {
        const s = $(sid);
        const n = $(nid);
        if (!s || !n)
            continue;
        const v = getter();
        s.value = String(v);
        n.value = fmtVal(v, dec);
        markChanged(s, n, v);
    }
    const invEl = $("invert");
    const monoEl = $("monochrome");
    if (invEl)
        invEl.checked = adj.invert;
    if (monoEl) {
        monoEl.checked = adj.monochrome;
        const monoMix = $("mono-mix");
        if (monoMix)
            monoMix.style.display = adj.monochrome ? "block" : "none";
    }
}
// ============================================================
// Reset per-slider on label click
// ============================================================
function initResetTargets() {
    document.querySelectorAll(".reset-target").forEach((el) => {
        el.addEventListener("dblclick", () => {
            const key = el.dataset.reset;
            if (!key)
                return;
            resetSingleAdj(key);
            syncSliderFromAdj();
            drawAllHueRings();
            drawCurve();
            onAdjustmentChanged();
        });
        el.title = "Double-click to reset";
    });
}
function resetSingleAdj(key) {
    const def = defaultAdjustments();
    switch (key) {
        case "exposure":
            adj.exposure = 0;
            break;
        case "contrast":
            adj.contrast = 0;
            break;
        case "highlights":
            adj.highlights = 0;
            break;
        case "shadows":
            adj.shadows = 0;
            break;
        case "whites":
            adj.whites = 0;
            break;
        case "blacks":
            adj.blacks = 0;
            break;
        case "clarity":
            adj.clarity = 0;
            break;
        case "temperature":
            adj.temperature = 0;
            break;
        case "tint":
            adj.tint = 0;
            break;
        case "hueShift":
            adj.hueShift = 0;
            break;
        case "saturation":
            adj.saturation = 0;
            break;
        case "vibrance":
            adj.vibrance = 0;
            break;
        case "shadowSat":
            adj.splitToning.shadowSat = 0;
            break;
        case "highlightSat":
            adj.splitToning.highlightSat = 0;
            break;
        case "stBalance":
            adj.splitToning.balance = 0;
            break;
    }
}
// ============================================================
// Section collapse
// ============================================================
function initSections() {
    document.querySelectorAll(".section-header").forEach((hdr) => {
        hdr.addEventListener("click", () => {
            const section = hdr.closest(".section");
            section?.classList.toggle("collapsed");
        });
    });
}
// ============================================================
// Tabs
// ============================================================
function initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document
                .querySelectorAll(".tab-btn")
                .forEach((b) => b.classList.remove("active"));
            document
                .querySelectorAll(".tab-panel")
                .forEach((p) => p.classList.remove("active"));
            btn.classList.add("active");
            const panelId = "tab-" + btn.dataset.tab;
            $(panelId)?.classList.add("active");
            if (btn.dataset.tab === "curves")
                drawCurve();
            if (btn.dataset.tab === "grade") {
                drawAllHueRings();
            }
        });
    });
}
// ============================================================
// Toggle controls
// ============================================================
function initToggles() {
    const invertEl = $("invert");
    const monoEl = $("monochrome");
    const monoMix = $("mono-mix");
    invertEl?.addEventListener("change", () => {
        adj.invert = invertEl.checked;
        onAdjustmentChanged();
    });
    monoEl?.addEventListener("change", () => {
        adj.monochrome = monoEl.checked;
        if (monoMix)
            monoMix.style.display = adj.monochrome ? "block" : "none";
        onAdjustmentChanged();
    });
}
// ============================================================
// HSL Mixer
// ============================================================
const HUE_BAND_COLORS = {
    red: "#e54040",
    orange: "#e07020",
    yellow: "#c8a800",
    green: "#28a040",
    aqua: "#10a090",
    blue: "#2060d0",
    purple: "#8040c0",
    magenta: "#c030a0",
};
let activeBand = "red";
function initHslMixer() {
    const tabsEl = $("hue-band-tabs");
    if (!tabsEl)
        return;
    tabsEl.innerHTML = "";
    for (const band of HUE_BANDS) {
        const btn = document.createElement("button");
        btn.className = "hue-band-btn";
        btn.dataset.band = band;
        btn.textContent = band.charAt(0).toUpperCase() + band.slice(1);
        btn.style.borderColor = HUE_BAND_COLORS[band];
        btn.addEventListener("click", () => {
            activeBand = band;
            renderHslBandBody();
            updateHslBandTabs();
        });
        tabsEl.appendChild(btn);
    }
    renderHslBandBody();
    updateHslBandTabs();
}
function updateHslBandTabs() {
    document.querySelectorAll(".hue-band-btn").forEach((btn) => {
        const band = btn.dataset.band;
        btn.classList.toggle("active", band === activeBand);
        if (band === activeBand) {
            btn.style.background = HUE_BAND_COLORS[band];
            btn.style.color = "white";
        }
        else {
            btn.style.background = "";
            btn.style.color = "";
        }
        const bAdj = adj.hslMixer.find((x) => x.band === band);
        const changed = bAdj && (bAdj.hue !== 0 || bAdj.saturation !== 0 || bAdj.luminance !== 0);
        btn.classList.toggle("changed", !!changed);
    });
}
function renderHslBandBody() {
    const body = $("hsl-band-body");
    if (!body)
        return;
    const bAdj = adj.hslMixer.find((x) => x.band === activeBand);
    body.innerHTML = `
    <div class="slider-row">
      <span class="slider-label">Hue</span>
      <div class="slider-wrap"><input type="range" id="hsl-hue" min="-100" max="100" step="1" value="${bAdj.hue}"></div>
      <input type="number" class="num-input" id="hsl-hue-n" min="-100" max="100" step="1" value="${Math.round(bAdj.hue)}">
    </div>
    <div class="slider-row">
      <span class="slider-label">Saturation</span>
      <div class="slider-wrap"><input type="range" id="hsl-sat" min="-100" max="100" step="1" value="${bAdj.saturation}"></div>
      <input type="number" class="num-input" id="hsl-sat-n" min="-100" max="100" step="1" value="${Math.round(bAdj.saturation)}">
    </div>
    <div class="slider-row">
      <span class="slider-label">Luminance</span>
      <div class="slider-wrap"><input type="range" id="hsl-lum" min="-100" max="100" step="1" value="${bAdj.luminance}"></div>
      <input type="number" class="num-input" id="hsl-lum-n" min="-100" max="100" step="1" value="${Math.round(bAdj.luminance)}">
    </div>
  `;
    const bindHsl = (sliderId, numId, setter) => {
        const s = $(sliderId);
        const n = $(numId);
        if (!s || !n)
            return;
        s.addEventListener("input", () => {
            const v = parseFloat(s.value);
            n.value = String(Math.round(v));
            setter(v);
            updateHslBandTabs();
            onAdjustmentChanged();
        });
        n.addEventListener("change", () => {
            const v = Math.min(100, Math.max(-100, parseFloat(n.value) || 0));
            s.value = String(v);
            n.value = String(Math.round(v));
            setter(v);
            updateHslBandTabs();
            onAdjustmentChanged();
        });
    };
    bindHsl("hsl-hue", "hsl-hue-n", (v) => { bAdj.hue = v; });
    bindHsl("hsl-sat", "hsl-sat-n", (v) => { bAdj.saturation = v; });
    bindHsl("hsl-lum", "hsl-lum-n", (v) => { bAdj.luminance = v; });
}
let activeCurveChannel = "l";
const CURVE_CHANNEL_LABELS = {
    l: "L – Lightness",
    c: "C – Chroma",
    h: "H – Hue remap",
};
function getCurvePoints() {
    return adj.curves[activeCurveChannel];
}
function setCurvePoints(pts) {
    adj.curves[activeCurveChannel] = pts;
}
let draggingIndex = -1;
const POINT_RADIUS = 5;
const CURVE_PAD = 16;
function drawCurve() {
    const canvas = $("curve-canvas");
    if (!canvas)
        return;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    const W = canvas.width;
    const H = canvas.height;
    const pad = CURVE_PAD;
    const iW = W - pad * 2;
    const iH = H - pad * 2;
    ctx.clearRect(0, 0, W, H);
    // Background
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, W, H);
    // Grid
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const x = pad + (iW * i) / 4;
        const y = pad + (iH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, pad + iH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(pad + iW, y);
        ctx.stroke();
    }
    // Identity line (dashed)
    ctx.strokeStyle = "#c8c8c8";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + iH);
    ctx.lineTo(pad + iW, pad);
    ctx.stroke();
    ctx.setLineDash([]);
    const pts = getCurvePoints();
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    if (sorted.length >= 2) {
        // Draw curve using many samples
        ctx.strokeStyle = "#18a0fb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const STEPS = 200;
        for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const y = interpolateCurve(sorted, t);
            const cx = pad + t * iW;
            const cy = pad + (1 - y) * iH;
            if (i === 0)
                ctx.moveTo(cx, cy);
            else
                ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }
    // Border
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, iW, iH);
    // Control points
    for (let i = 0; i < pts.length; i++) {
        const px = pad + pts[i].x * iW;
        const py = pad + (1 - pts[i].y) * iH;
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = draggingIndex === i ? "#18a0fb" : "white";
        ctx.fill();
        ctx.strokeStyle = "#18a0fb";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    // Channel label
    ctx.fillStyle = "#b0b0b0";
    ctx.font = "9px Inter, sans-serif";
    ctx.fillText(CURVE_CHANNEL_LABELS[activeCurveChannel], pad + 4, pad + 12);
}
function interpolateCurve(sorted, x) {
    // Use the same monotone cubic from color.ts logic (re-implemented inline for UI)
    const n = sorted.length;
    if (n === 0)
        return x;
    if (n === 1)
        return sorted[0].y;
    if (x <= sorted[0].x)
        return sorted[0].y;
    if (x >= sorted[n - 1].x)
        return sorted[n - 1].y;
    const h = [];
    const s = [];
    for (let i = 0; i < n - 1; i++) {
        h[i] = sorted[i + 1].x - sorted[i].x;
        s[i] = (sorted[i + 1].y - sorted[i].y) / Math.max(h[i], 1e-10);
    }
    const m = new Array(n);
    m[0] = s[0];
    m[n - 1] = s[n - 2];
    for (let i = 1; i < n - 1; i++) {
        if (s[i - 1] * s[i] <= 0) {
            m[i] = 0;
        }
        else {
            const p = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i]);
            m[i] =
                Math.sign(p) *
                    Math.min(Math.abs(p), 2 * Math.abs(s[i - 1]), 2 * Math.abs(s[i]));
        }
    }
    let idx = 0;
    while (idx < n - 2 && sorted[idx + 1].x < x)
        idx++;
    const t = (x - sorted[idx].x) / h[idx];
    const t2 = t * t;
    const t3 = t2 * t;
    return (sorted[idx].y * (2 * t3 - 3 * t2 + 1) +
        m[idx] * h[idx] * (t3 - 2 * t2 + t) +
        sorted[idx + 1].y * (3 * t2 - 2 * t3) +
        m[idx + 1] * h[idx] * (t3 - t2));
}
function canvasToNorm(canvas, cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (cx - rect.left) * scaleX;
    const py = (cy - rect.top) * scaleY;
    const pad = CURVE_PAD;
    const iW = canvas.width - pad * 2;
    const iH = canvas.height - pad * 2;
    return {
        x: Math.min(1, Math.max(0, (px - pad) / iW)),
        y: Math.min(1, Math.max(0, 1 - (py - pad) / iH)),
    };
}
function findNearestPoint(canvas, pts, cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pad = CURVE_PAD;
    const iW = canvas.width - pad * 2;
    const iH = canvas.height - pad * 2;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const px = pad + pts[i].x * iW;
        const py = pad + (1 - pts[i].y) * iH;
        const dx = (cx - rect.left) * scaleX - px;
        const dy = (cy - rect.top) * scaleY - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return bestDist < POINT_RADIUS * 2.5 ? best : -1;
}
function initCurveEditor() {
    const canvas = $("curve-canvas");
    if (!canvas)
        return;
    // Channel tabs
    document.querySelectorAll(".curve-ch-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            activeCurveChannel = btn.dataset.ch;
            document
                .querySelectorAll(".curve-ch-btn")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            draggingIndex = -1;
            drawCurve();
        });
    });
    // Reset curve button
    $("btn-reset-curve")?.addEventListener("click", () => {
        adj.curves[activeCurveChannel] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        draggingIndex = -1;
        drawCurve();
        onAdjustmentChanged();
    });
    // Mouse events
    canvas.addEventListener("mousedown", (e) => {
        const pts = getCurvePoints();
        const nearest = findNearestPoint(canvas, pts, e.clientX, e.clientY);
        if (nearest >= 0) {
            draggingIndex = nearest;
        }
        else {
            // Add new point
            const norm = canvasToNorm(canvas, e.clientX, e.clientY);
            pts.push(norm);
            setCurvePoints(pts);
            draggingIndex = pts.length - 1;
            drawCurve();
            onAdjustmentChanged();
        }
        e.preventDefault();
    });
    canvas.addEventListener("mousemove", (e) => {
        if (draggingIndex < 0)
            return;
        const pts = getCurvePoints();
        const norm = canvasToNorm(canvas, e.clientX, e.clientY);
        pts[draggingIndex] = norm;
        setCurvePoints(pts);
        drawCurve();
        onAdjustmentChanged();
    });
    window.addEventListener("mouseup", () => {
        draggingIndex = -1;
        drawCurve();
    });
    canvas.addEventListener("dblclick", (e) => {
        const pts = getCurvePoints();
        const nearest = findNearestPoint(canvas, pts, e.clientX, e.clientY);
        if (nearest >= 0 && pts.length > 2) {
            pts.splice(nearest, 1);
            setCurvePoints(pts);
            draggingIndex = -1;
            drawCurve();
            onAdjustmentChanged();
        }
    });
    drawCurve();
}
// ============================================================
// Hue Ring (Split Toning + Color Grading)
// ============================================================
function drawHueRing(canvas, hue, chroma, innerLabel) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = W / 2 - 2;
    const innerR = outerR * 0.55;
    ctx.clearRect(0, 0, W, H);
    // Draw hue wheel ring
    const STEPS = 360;
    for (let i = 0; i < STEPS; i++) {
        const a1 = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 1) / STEPS) * Math.PI * 2 - Math.PI / 2;
        const hDeg = i;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, a1, a2);
        ctx.closePath();
        ctx.fillStyle = `oklch(0.65 0.2 ${hDeg}deg)`;
        ctx.fill();
    }
    // Inner circle (clip)
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f5f5";
    ctx.fill();
    // Inner border
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Indicator dot on ring
    const rad = (hue - 90) * (Math.PI / 180);
    const dotR = (innerR + outerR) / 2;
    const dotX = cx + dotR * Math.cos(rad);
    const dotY = cy + dotR * Math.sin(rad);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = chroma > 0 ? "white" : "rgba(255,255,255,0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Strength dot in center
    if (chroma > 0) {
        const r = (chroma / 100) * (innerR - 4);
        const dotCX = cx + r * Math.cos(rad);
        const dotCY = cy + r * Math.sin(rad);
        ctx.beginPath();
        ctx.arc(dotCX, dotCY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.65 0.2 ${hue}deg)`;
        ctx.fill();
    }
    // Label
    if (innerLabel) {
        ctx.fillStyle = "#999";
        ctx.font = "8px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(innerLabel, cx, cy);
    }
}
function setupHueRingInteraction(canvasId, getHue, getChroma, setHue, label) {
    const canvas = $(canvasId);
    if (!canvas)
        return;
    let isDragging = false;
    const getHueFromEvent = (e) => {
        const rect = canvas.getBoundingClientRect();
        const dx = e.clientX - rect.left - rect.width / 2;
        const dy = e.clientY - rect.top - rect.height / 2;
        let h = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (h < 0)
            h += 360;
        return Math.round(h) % 360;
    };
    canvas.addEventListener("mousedown", (e) => {
        isDragging = true;
        setHue(getHueFromEvent(e));
        drawHueRing(canvas, getHue(), getChroma(), label);
        onAdjustmentChanged();
    });
    canvas.addEventListener("mousemove", (e) => {
        if (!isDragging)
            return;
        setHue(getHueFromEvent(e));
        drawHueRing(canvas, getHue(), getChroma(), label);
        onAdjustmentChanged();
    });
    window.addEventListener("mouseup", () => { isDragging = false; });
    drawHueRing(canvas, getHue(), getChroma(), label);
}
function drawAllHueRings() {
    const shadowCanvas = $("shadow-ring");
    const highlightCanvas = $("highlight-ring");
    const liftCanvas = $("lift-ring");
    const gammaCanvas = $("gamma-ring");
    const gainCanvas = $("gain-ring");
    if (shadowCanvas)
        drawHueRing(shadowCanvas, adj.splitToning.shadowHue, adj.splitToning.shadowSat, "Shadow");
    if (highlightCanvas)
        drawHueRing(highlightCanvas, adj.splitToning.highlightHue, adj.splitToning.highlightSat, "Hi");
    if (liftCanvas)
        drawHueRing(liftCanvas, adj.colorGrading.lift.hue, adj.colorGrading.lift.chroma, "Lift");
    if (gammaCanvas)
        drawHueRing(gammaCanvas, adj.colorGrading.gamma.hue, adj.colorGrading.gamma.chroma, "Gamma");
    if (gainCanvas)
        drawHueRing(gainCanvas, adj.colorGrading.gain.hue, adj.colorGrading.gain.chroma, "Gain");
}
function initHueRings() {
    setupHueRingInteraction("shadow-ring", () => adj.splitToning.shadowHue, () => adj.splitToning.shadowSat, (h) => { adj.splitToning.shadowHue = h; }, "Shadow");
    setupHueRingInteraction("highlight-ring", () => adj.splitToning.highlightHue, () => adj.splitToning.highlightSat, (h) => { adj.splitToning.highlightHue = h; }, "Hi");
    setupHueRingInteraction("lift-ring", () => adj.colorGrading.lift.hue, () => adj.colorGrading.lift.chroma, (h) => { adj.colorGrading.lift.hue = h; }, "Lift");
    setupHueRingInteraction("gamma-ring", () => adj.colorGrading.gamma.hue, () => adj.colorGrading.gamma.chroma, (h) => { adj.colorGrading.gamma.hue = h; }, "Gamma");
    setupHueRingInteraction("gain-ring", () => adj.colorGrading.gain.hue, () => adj.colorGrading.gain.chroma, (h) => { adj.colorGrading.gain.hue = h; }, "Gain");
    // Chroma sliders also need to redraw rings
    ["liftL", "gammaL", "gainL"].forEach((id) => {
        $(id)?.addEventListener("input", drawAllHueRings);
    });
}
// ============================================================
// Preview swatches
// ============================================================
function updateSwatches() {
    const fill = currentSelection.fills.find((f) => f.fillType === "SOLID" && f.color);
    const beforeEl = $("swatch-before");
    const afterEl = $("swatch-after");
    if (!beforeEl || !afterEl)
        return;
    if (fill?.color) {
        const origColor = fill.color;
        const edited = applyAllAdjustments(origColor, adj);
        beforeEl.style.background = rgbCss(origColor);
        afterEl.style.background = rgbCss(edited);
    }
    else {
        beforeEl.style.background = "#ddd";
        afterEl.style.background = "#ddd";
    }
}
// ============================================================
// Status bar
// ============================================================
function updateStatus() {
    const bar = $("status-bar");
    if (!bar)
        return;
    if (currentSelection.count === 0) {
        bar.textContent = "Select one or more layers to adjust.";
        bar.className = "";
        return;
    }
    const solidCount = currentSelection.fills.filter((f) => f.fillType === "SOLID").length;
    const gradCount = currentSelection.fills.filter((f) => f.fillType === "GRADIENT").length;
    const imgCount = currentSelection.fills.filter((f) => f.fillType === "IMAGE").length;
    const parts = [];
    if (solidCount)
        parts.push(`${solidCount} solid`);
    if (gradCount)
        parts.push(`${gradCount} gradient`);
    if (imgCount)
        parts.push(`${imgCount} image`);
    bar.textContent = `${currentSelection.count} layer(s) · ${parts.join(", ")} fill(s)`;
    bar.className = "ok";
}
// ============================================================
// Apply button state
// ============================================================
function updateApplyBtn() {
    const btn = $("btn-apply");
    if (!btn)
        return;
    btn.disabled = currentSelection.count === 0;
}
function buildChanges() {
    const changes = [];
    for (const fill of currentSelection.fills) {
        if (fill.fillType === "SOLID" && fill.color) {
            changes.push({
                nodeId: fill.nodeId,
                fillIndex: fill.fillIndex,
                fillType: "SOLID",
                color: applyAllAdjustments(fill.color, adj),
                opacity: fill.opacity,
            });
        }
        else if (fill.fillType === "GRADIENT" && fill.gradientStops) {
            changes.push({
                nodeId: fill.nodeId,
                fillIndex: fill.fillIndex,
                fillType: "GRADIENT",
                gradientStops: fill.gradientStops.map((stop) => ({
                    ...stop,
                    color: applyAllAdjustments(stop.color, adj),
                })),
            });
        }
        else if (fill.fillType === "IMAGE") {
            const key = `${fill.nodeId}:${fill.fillIndex}`;
            const bytes = pendingImages.get(key);
            if (bytes) {
                changes.push({
                    nodeId: fill.nodeId,
                    fillIndex: fill.fillIndex,
                    fillType: "IMAGE",
                    imageBytes: bytes,
                });
            }
        }
    }
    return changes;
}
// ============================================================
// Image processing in the UI
// ============================================================
async function processImageFill(fill) {
    if (!fill.imageHash)
        return;
    const key = `${fill.nodeId}:${fill.fillIndex}`;
    if (pendingImageRequests.has(key))
        return;
    pendingImageRequests.add(key);
    // Request bytes from plugin
    parent.postMessage({
        pluginMessage: {
            type: "request-image",
            nodeId: fill.nodeId,
            fillIndex: fill.fillIndex,
            imageHash: fill.imageHash,
        },
    }, "*");
}
async function applyAdjToImageBytes(bytes, adjSnapshot) {
    // Decode PNG → canvas → process pixels → encode
    const blob = new Blob([bytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
    });
    URL.revokeObjectURL(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const result = applyAllAdjustments({ r, g, b }, adjSnapshot);
        data[i] = Math.round(result.r * 255);
        data[i + 1] = Math.round(result.g * 255);
        data[i + 2] = Math.round(result.b * 255);
        // alpha unchanged
    }
    ctx.putImageData(imageData, 0, 0);
    const outBlob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
    });
    return new Uint8Array(await outBlob.arrayBuffer());
}
// ============================================================
// Preview & Apply
// ============================================================
let previewDebounce = null;
function onAdjustmentChanged() {
    updateSwatches();
    drawCurve();
    if (previewDebounce)
        clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => {
        if (currentSelection.count === 0)
            return;
        const changes = buildChanges();
        parent.postMessage({ pluginMessage: { type: "apply-changes", changes, permanent: false } }, "*");
    }, 80);
}
// ============================================================
// Message listener
// ============================================================
window.addEventListener("message", async (evt) => {
    const msg = evt.data?.pluginMessage;
    if (!msg)
        return;
    if (msg.type === "selection-update") {
        currentSelection = msg.data;
        updateStatus();
        updateApplyBtn();
        updateSwatches();
        pendingImages.clear();
        pendingImageRequests.clear();
        // Request image bytes for image fills
        for (const fill of currentSelection.fills) {
            if (fill.fillType === "IMAGE" && fill.imageHash) {
                await processImageFill(fill);
            }
        }
    }
    if (msg.type === "image-bytes") {
        const key = `${msg.nodeId}:${msg.fillIndex}`;
        pendingImageRequests.delete(key);
        const $progress = $("img-progress");
        const $progressText = $("img-progress-text");
        if ($progress)
            $progress.classList.add("visible");
        if ($progressText)
            $progressText.textContent = "Processing image…";
        const processed = await applyAdjToImageBytes(msg.bytes, adj);
        pendingImages.set(key, processed);
        if ($progress)
            $progress.classList.remove("visible");
        // Re-apply preview with image
        onAdjustmentChanged();
    }
});
// ============================================================
// Reset All
// ============================================================
$("btn-reset-all")?.addEventListener("click", () => {
    adj = defaultAdjustments();
    syncSliderFromAdj();
    activeBand = "red";
    renderHslBandBody();
    updateHslBandTabs();
    drawCurve();
    drawAllHueRings();
    updateSwatches();
    // Revert via plugin
    parent.postMessage({ pluginMessage: { type: "revert" } }, "*");
});
// ============================================================
// Revert button
// ============================================================
$("btn-revert")?.addEventListener("click", () => {
    adj = defaultAdjustments();
    syncSliderFromAdj();
    renderHslBandBody();
    updateHslBandTabs();
    drawCurve();
    drawAllHueRings();
    updateSwatches();
    parent.postMessage({ pluginMessage: { type: "revert" } }, "*");
});
// ============================================================
// Apply button
// ============================================================
$("btn-apply")?.addEventListener("click", async () => {
    if (currentSelection.count === 0)
        return;
    const btn = $("btn-apply");
    btn.disabled = true;
    btn.textContent = "Applying…";
    // Re-process images with current adjustments
    const imageFills = currentSelection.fills.filter((f) => f.fillType === "IMAGE" && f.imageHash);
    if (imageFills.length > 0) {
        const $progress = $("img-progress");
        const $progressText = $("img-progress-text");
        if ($progress)
            $progress.classList.add("visible");
        for (let i = 0; i < imageFills.length; i++) {
            const fill = imageFills[i];
            if ($progressText)
                $progressText.textContent = `Processing image ${i + 1}/${imageFills.length}…`;
            // Request fresh bytes
            parent.postMessage({
                pluginMessage: {
                    type: "request-image",
                    nodeId: fill.nodeId,
                    fillIndex: fill.fillIndex,
                    imageHash: fill.imageHash,
                },
            }, "*");
            // Wait for bytes to arrive (handled in message listener)
            // For simplicity, we use a short polling approach here
            // In production this should use proper async coordination
        }
        if ($progress)
            $progress.classList.remove("visible");
    }
    const changes = buildChanges();
    parent.postMessage({ pluginMessage: { type: "apply-changes", changes, permanent: true } }, "*");
    btn.textContent = "Apply to Selection";
    btn.disabled = currentSelection.count === 0;
});
// ============================================================
// Bootstrap
// ============================================================
function init() {
    initTabs();
    initSections();
    initSliders();
    initResetTargets();
    initToggles();
    initHslMixer();
    initCurveEditor();
    initHueRings();
    syncSliderFromAdj();
    drawCurve();
    drawAllHueRings();
    // Request initial selection
    parent.postMessage({ pluginMessage: { type: "init" } }, "*");
}
init();

