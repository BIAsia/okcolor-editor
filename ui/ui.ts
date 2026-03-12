import {
  applyAllAdjustments,
  defaultAdjustments,
  HUE_BANDS,
  type Adjustments,
  type CurvePoint,
  type HueBand,
  type RGB,
} from "../src/color";

// ============================================================
// Helpers
// ============================================================

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function rgbCss(rgb: RGB): string {
  return `rgb(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)})`;
}

function parseRgb(rgb: RGB): string {
  return rgbCss(rgb);
}

function fmtVal(v: number, decimals = 0): string {
  return decimals ? v.toFixed(decimals) : String(Math.round(v));
}

// ============================================================
// State
// ============================================================

let adj: Adjustments = defaultAdjustments();

interface FillInfo {
  nodeId: string;
  nodeName: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
  color?: RGB;
  opacity?: number;
  gradientStops?: Array<{ color: RGB; opacity: number; position: number }>;
  imageHash?: string;
}

interface SelectionInfo {
  count: number;
  fills: FillInfo[];
  hasImages: boolean;
}

let currentSelection: SelectionInfo = { count: 0, fills: [], hasImages: false };
// Pending processed image bytes keyed by `nodeId:fillIndex`
const pendingImages = new Map<string, Uint8Array>();
// Requested images waiting for bytes from plugin
const pendingImageRequests = new Set<string>();

// ============================================================
// Slider ↔ NumberInput sync
// ============================================================

/** Pairs of [sliderId, numberInputId, adjKey, decimals] */
const SLIDER_DEFS: Array<[string, string, keyof Adjustments, number]> = [
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
  ["shadowSat", "shadowSat-n", "splitToning", 0],   // handled specially
  ["highlightSat", "highlightSat-n", "splitToning", 0],
  ["stBalance", "stBalance-n", "splitToning", 0],
  ["liftL", "liftL-n", "colorGrading", 0],
  ["gammaL", "gammaL-n", "colorGrading", 0],
  ["gainL", "gainL-n", "colorGrading", 0],
];

function initSliders(): void {
  for (const [sliderId, numId, key, dec] of SLIDER_DEFS) {
    const slider = $<HTMLInputElement>(sliderId);
    const numInput = $<HTMLInputElement>(numId);
    if (!slider || !numInput) continue;

    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      numInput.value = fmtVal(v, dec);
      setAdjFromSlider(key as string, v);
      markChanged(slider, numInput, v);
      onAdjustmentChanged();
    });

    numInput.addEventListener("change", () => {
      const v = clampNum(parseFloat(numInput.value), slider);
      slider.value = String(v);
      numInput.value = fmtVal(v, dec);
      setAdjFromSlider(key as string, v);
      markChanged(slider, numInput, v);
      onAdjustmentChanged();
    });
  }
}

function clampNum(v: number, slider: HTMLInputElement): number {
  const lo = parseFloat(slider.min);
  const hi = parseFloat(slider.max);
  return Math.min(hi, Math.max(lo, isNaN(v) ? 0 : v));
}

function markChanged(
  slider: HTMLInputElement,
  numInput: HTMLInputElement,
  value: number
): void {
  const def = parseFloat(slider.dataset.default ?? "0");
  const isChanged = Math.abs(value - def) > 0.001;
  slider.classList.toggle("changed", isChanged);
  numInput.classList.toggle("changed", isChanged);
}

function setAdjFromSlider(key: string, v: number): void {
  switch (key) {
    case "exposure": adj.exposure = v; break;
    case "contrast": adj.contrast = v; break;
    case "highlights": adj.highlights = v; break;
    case "shadows": adj.shadows = v; break;
    case "whites": adj.whites = v; break;
    case "blacks": adj.blacks = v; break;
    case "clarity": adj.clarity = v; break;
    case "temperature": adj.temperature = v; break;
    case "tint": adj.tint = v; break;
    case "hueShift": adj.hueShift = v; break;
    case "saturation": adj.saturation = v; break;
    case "vibrance": adj.vibrance = v; break;
    case "monoR": adj.monoR = v; break;
    case "monoG": adj.monoG = v; break;
    case "monoB": adj.monoB = v; break;
    case "shadowSat": adj.splitToning.shadowSat = v; break;
    case "highlightSat": adj.splitToning.highlightSat = v; break;
    case "stBalance": adj.splitToning.balance = v; break;
    case "liftL": adj.colorGrading.lift.l = v; break;
    case "gammaL": adj.colorGrading.gamma.l = v; break;
    case "gainL": adj.colorGrading.gain.l = v; break;
  }
}

function syncSliderFromAdj(): void {
  type NumKey = keyof {
    [K in keyof Adjustments as Adjustments[K] extends number ? K : never]: number;
  };
  const numericPairs: Array<[string, string, () => number, number]> = [
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
    const s = $<HTMLInputElement>(sid);
    const n = $<HTMLInputElement>(nid);
    if (!s || !n) continue;
    const v = getter();
    s.value = String(v);
    n.value = fmtVal(v, dec);
    markChanged(s, n, v);
  }

  const invEl = $<HTMLInputElement>("invert");
  const monoEl = $<HTMLInputElement>("monochrome");
  if (invEl) invEl.checked = adj.invert;
  if (monoEl) {
    monoEl.checked = adj.monochrome;
    const monoMix = $("mono-mix");
    if (monoMix) monoMix.style.display = adj.monochrome ? "block" : "none";
  }
}

// ============================================================
// Reset per-slider on label click
// ============================================================

function initResetTargets(): void {
  document.querySelectorAll<HTMLElement>(".reset-target").forEach((el) => {
    el.addEventListener("dblclick", () => {
      const key = el.dataset.reset;
      if (!key) return;
      resetSingleAdj(key);
      syncSliderFromAdj();
      drawAllHueRings();
      drawCurve();
      onAdjustmentChanged();
    });
    el.title = "Double-click to reset";
  });
}

function resetSingleAdj(key: string): void {
  const def = defaultAdjustments();
  switch (key) {
    case "exposure": adj.exposure = 0; break;
    case "contrast": adj.contrast = 0; break;
    case "highlights": adj.highlights = 0; break;
    case "shadows": adj.shadows = 0; break;
    case "whites": adj.whites = 0; break;
    case "blacks": adj.blacks = 0; break;
    case "clarity": adj.clarity = 0; break;
    case "temperature": adj.temperature = 0; break;
    case "tint": adj.tint = 0; break;
    case "hueShift": adj.hueShift = 0; break;
    case "saturation": adj.saturation = 0; break;
    case "vibrance": adj.vibrance = 0; break;
    case "shadowSat": adj.splitToning.shadowSat = 0; break;
    case "highlightSat": adj.splitToning.highlightSat = 0; break;
    case "stBalance": adj.splitToning.balance = 0; break;
  }
}

// ============================================================
// Section collapse
// ============================================================

function initSections(): void {
  document.querySelectorAll<HTMLElement>(".section-header").forEach((hdr) => {
    hdr.addEventListener("click", () => {
      const section = hdr.closest(".section") as HTMLElement;
      section?.classList.toggle("collapsed");
    });
  });
}

// ============================================================
// Tabs
// ============================================================

function initTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panelId = "tab-" + btn.dataset.tab;
      $<HTMLElement>(panelId)?.classList.add("active");
      if (btn.dataset.tab === "curves") drawCurve();
      if (btn.dataset.tab === "grade") {
        drawAllHueRings();
      }
    });
  });
}

// ============================================================
// Toggle controls
// ============================================================

function initToggles(): void {
  const invertEl = $<HTMLInputElement>("invert");
  const monoEl = $<HTMLInputElement>("monochrome");
  const monoMix = $("mono-mix");

  invertEl?.addEventListener("change", () => {
    adj.invert = invertEl.checked;
    onAdjustmentChanged();
  });

  monoEl?.addEventListener("change", () => {
    adj.monochrome = monoEl.checked;
    if (monoMix) monoMix.style.display = adj.monochrome ? "block" : "none";
    onAdjustmentChanged();
  });
}

// ============================================================
// HSL Mixer
// ============================================================

const HUE_BAND_COLORS: Record<HueBand, string> = {
  red: "#e54040",
  orange: "#e07020",
  yellow: "#c8a800",
  green: "#28a040",
  aqua: "#10a090",
  blue: "#2060d0",
  purple: "#8040c0",
  magenta: "#c030a0",
};

let activeBand: HueBand = "red";

function initHslMixer(): void {
  const tabsEl = $("hue-band-tabs");
  if (!tabsEl) return;

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

function updateHslBandTabs(): void {
  document.querySelectorAll<HTMLElement>(".hue-band-btn").forEach((btn) => {
    const band = btn.dataset.band as HueBand;
    btn.classList.toggle("active", band === activeBand);
    if (band === activeBand) {
      btn.style.background = HUE_BAND_COLORS[band];
      btn.style.color = "white";
    } else {
      btn.style.background = "";
      btn.style.color = "";
    }

    const bAdj = adj.hslMixer.find((x) => x.band === band);
    const changed =
      bAdj && (bAdj.hue !== 0 || bAdj.saturation !== 0 || bAdj.luminance !== 0);
    btn.classList.toggle("changed", !!changed);
  });
}

function renderHslBandBody(): void {
  const body = $("hsl-band-body");
  if (!body) return;

  const bAdj = adj.hslMixer.find((x) => x.band === activeBand)!;

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

  const bindHsl = (
    sliderId: string,
    numId: string,
    setter: (v: number) => void
  ) => {
    const s = $<HTMLInputElement>(sliderId);
    const n = $<HTMLInputElement>(numId);
    if (!s || !n) return;
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

// ============================================================
// Curves editor
// ============================================================

type CurveChannel = "l" | "c" | "h";
let activeCurveChannel: CurveChannel = "l";

const CURVE_CHANNEL_LABELS: Record<CurveChannel, string> = {
  l: "L – Lightness",
  c: "C – Chroma",
  h: "H – Hue remap",
};

function getCurvePoints(): CurvePoint[] {
  return adj.curves[activeCurveChannel];
}

function setCurvePoints(pts: CurvePoint[]): void {
  adj.curves[activeCurveChannel] = pts;
}

let draggingIndex = -1;
const POINT_RADIUS = 5;
const CURVE_PAD = 16;

function drawCurve(): void {
  const canvas = $<HTMLCanvasElement>("curve-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + iH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + iW, y); ctx.stroke();
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
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
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

function interpolateCurve(sorted: CurvePoint[], x: number): number {
  // Use the same monotone cubic from color.ts logic (re-implemented inline for UI)
  const n = sorted.length;
  if (n === 0) return x;
  if (n === 1) return sorted[0].y;
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[n - 1].x) return sorted[n - 1].y;

  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = sorted[i + 1].x - sorted[i].x;
    s[i] = (sorted[i + 1].y - sorted[i].y) / Math.max(h[i], 1e-10);
  }

  const m: number[] = new Array(n);
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

  let idx = 0;
  while (idx < n - 2 && sorted[idx + 1].x < x) idx++;
  const t = (x - sorted[idx].x) / h[idx];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    sorted[idx].y * (2 * t3 - 3 * t2 + 1) +
    m[idx] * h[idx] * (t3 - 2 * t2 + t) +
    sorted[idx + 1].y * (3 * t2 - 2 * t3) +
    m[idx + 1] * h[idx] * (t3 - t2)
  );
}

function canvasToNorm(
  canvas: HTMLCanvasElement,
  cx: number,
  cy: number
): { x: number; y: number } {
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

function findNearestPoint(
  canvas: HTMLCanvasElement,
  pts: CurvePoint[],
  cx: number,
  cy: number
): number {
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

function initCurveEditor(): void {
  const canvas = $<HTMLCanvasElement>("curve-canvas");
  if (!canvas) return;

  // Channel tabs
  document.querySelectorAll<HTMLButtonElement>(".curve-ch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCurveChannel = btn.dataset.ch as CurveChannel;
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
    } else {
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
    if (draggingIndex < 0) return;
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

function drawHueRing(
  canvas: HTMLCanvasElement,
  hue: number,
  chroma: number,
  innerLabel?: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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

function setupHueRingInteraction(
  canvasId: string,
  getHue: () => number,
  getChroma: () => number,
  setHue: (h: number) => void,
  label?: string
): void {
  const canvas = $<HTMLCanvasElement>(canvasId);
  if (!canvas) return;

  let isDragging = false;

  const getHueFromEvent = (e: MouseEvent): number => {
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    let h = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (h < 0) h += 360;
    return Math.round(h) % 360;
  };

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    setHue(getHueFromEvent(e));
    drawHueRing(canvas, getHue(), getChroma(), label);
    onAdjustmentChanged();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    setHue(getHueFromEvent(e));
    drawHueRing(canvas, getHue(), getChroma(), label);
    onAdjustmentChanged();
  });

  window.addEventListener("mouseup", () => { isDragging = false; });

  drawHueRing(canvas, getHue(), getChroma(), label);
}

function drawAllHueRings(): void {
  const shadowCanvas = $<HTMLCanvasElement>("shadow-ring");
  const highlightCanvas = $<HTMLCanvasElement>("highlight-ring");
  const liftCanvas = $<HTMLCanvasElement>("lift-ring");
  const gammaCanvas = $<HTMLCanvasElement>("gamma-ring");
  const gainCanvas = $<HTMLCanvasElement>("gain-ring");

  if (shadowCanvas) drawHueRing(shadowCanvas, adj.splitToning.shadowHue, adj.splitToning.shadowSat, "Shadow");
  if (highlightCanvas) drawHueRing(highlightCanvas, adj.splitToning.highlightHue, adj.splitToning.highlightSat, "Hi");
  if (liftCanvas) drawHueRing(liftCanvas, adj.colorGrading.lift.hue, adj.colorGrading.lift.chroma, "Lift");
  if (gammaCanvas) drawHueRing(gammaCanvas, adj.colorGrading.gamma.hue, adj.colorGrading.gamma.chroma, "Gamma");
  if (gainCanvas) drawHueRing(gainCanvas, adj.colorGrading.gain.hue, adj.colorGrading.gain.chroma, "Gain");
}

function initHueRings(): void {
  setupHueRingInteraction(
    "shadow-ring",
    () => adj.splitToning.shadowHue,
    () => adj.splitToning.shadowSat,
    (h) => { adj.splitToning.shadowHue = h; },
    "Shadow"
  );
  setupHueRingInteraction(
    "highlight-ring",
    () => adj.splitToning.highlightHue,
    () => adj.splitToning.highlightSat,
    (h) => { adj.splitToning.highlightHue = h; },
    "Hi"
  );
  setupHueRingInteraction(
    "lift-ring",
    () => adj.colorGrading.lift.hue,
    () => adj.colorGrading.lift.chroma,
    (h) => { adj.colorGrading.lift.hue = h; },
    "Lift"
  );
  setupHueRingInteraction(
    "gamma-ring",
    () => adj.colorGrading.gamma.hue,
    () => adj.colorGrading.gamma.chroma,
    (h) => { adj.colorGrading.gamma.hue = h; },
    "Gamma"
  );
  setupHueRingInteraction(
    "gain-ring",
    () => adj.colorGrading.gain.hue,
    () => adj.colorGrading.gain.chroma,
    (h) => { adj.colorGrading.gain.hue = h; },
    "Gain"
  );

  // Chroma sliders also need to redraw rings
  ["liftL", "gammaL", "gainL"].forEach((id) => {
    $<HTMLInputElement>(id)?.addEventListener("input", drawAllHueRings);
  });
}

// ============================================================
// Preview swatches
// ============================================================

function updateSwatches(): void {
  const fill = currentSelection.fills.find(
    (f) => f.fillType === "SOLID" && f.color
  );
  const beforeEl = $("swatch-before") as HTMLElement;
  const afterEl = $("swatch-after") as HTMLElement;
  if (!beforeEl || !afterEl) return;

  if (fill?.color) {
    const origColor = fill.color;
    const edited = applyAllAdjustments(origColor, adj);
    beforeEl.style.background = rgbCss(origColor);
    afterEl.style.background = rgbCss(edited);
  } else {
    beforeEl.style.background = "#ddd";
    afterEl.style.background = "#ddd";
  }
}

// ============================================================
// Status bar
// ============================================================

function updateStatus(): void {
  const bar = $("status-bar");
  if (!bar) return;

  if (currentSelection.count === 0) {
    bar.textContent = "Select one or more layers to adjust.";
    bar.className = "";
    return;
  }

  const solidCount = currentSelection.fills.filter(
    (f) => f.fillType === "SOLID"
  ).length;
  const gradCount = currentSelection.fills.filter(
    (f) => f.fillType === "GRADIENT"
  ).length;
  const imgCount = currentSelection.fills.filter(
    (f) => f.fillType === "IMAGE"
  ).length;

  const parts: string[] = [];
  if (solidCount) parts.push(`${solidCount} solid`);
  if (gradCount) parts.push(`${gradCount} gradient`);
  if (imgCount) parts.push(`${imgCount} image`);
  bar.textContent = `${currentSelection.count} layer(s) · ${parts.join(", ")} fill(s)`;
  bar.className = "ok";
}

// ============================================================
// Apply button state
// ============================================================

function updateApplyBtn(): void {
  const btn = $<HTMLButtonElement>("btn-apply");
  if (!btn) return;
  btn.disabled = currentSelection.count === 0;
}

// ============================================================
// Build changes list from current adjustments
// ============================================================

interface ColorChange {
  nodeId: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
  color?: RGB;
  opacity?: number;
  gradientStops?: Array<{ color: RGB; opacity: number; position: number }>;
  imageBytes?: Uint8Array;
}

function buildChanges(): ColorChange[] {
  const changes: ColorChange[] = [];

  for (const fill of currentSelection.fills) {
    if (fill.fillType === "SOLID" && fill.color) {
      changes.push({
        nodeId: fill.nodeId,
        fillIndex: fill.fillIndex,
        fillType: "SOLID",
        color: applyAllAdjustments(fill.color, adj),
        opacity: fill.opacity,
      });
    } else if (fill.fillType === "GRADIENT" && fill.gradientStops) {
      changes.push({
        nodeId: fill.nodeId,
        fillIndex: fill.fillIndex,
        fillType: "GRADIENT",
        gradientStops: fill.gradientStops.map((stop) => ({
          ...stop,
          color: applyAllAdjustments(stop.color, adj),
        })),
      });
    } else if (fill.fillType === "IMAGE") {
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

async function processImageFill(fill: FillInfo): Promise<void> {
  if (!fill.imageHash) return;
  const key = `${fill.nodeId}:${fill.fillIndex}`;

  if (pendingImageRequests.has(key)) return;
  pendingImageRequests.add(key);

  // Request bytes from plugin
  parent.postMessage(
    {
      pluginMessage: {
        type: "request-image",
        nodeId: fill.nodeId,
        fillIndex: fill.fillIndex,
        imageHash: fill.imageHash,
      },
    },
    "*"
  );
}

async function applyAdjToImageBytes(
  bytes: Uint8Array,
  adjSnapshot: Adjustments
): Promise<Uint8Array> {
  // Decode PNG → canvas → process pixels → encode
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
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

  const outBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });
  return new Uint8Array(await outBlob.arrayBuffer());
}

// ============================================================
// Preview & Apply
// ============================================================

let previewDebounce: ReturnType<typeof setTimeout> | null = null;

function onAdjustmentChanged(): void {
  updateSwatches();
  drawCurve();

  if (previewDebounce) clearTimeout(previewDebounce);
  previewDebounce = setTimeout(() => {
    if (currentSelection.count === 0) return;
    const changes = buildChanges();
    parent.postMessage(
      { pluginMessage: { type: "apply-changes", changes, permanent: false } },
      "*"
    );
  }, 80);
}

// ============================================================
// Message listener
// ============================================================

window.addEventListener("message", async (evt: MessageEvent) => {
  const msg = evt.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === "selection-update") {
    currentSelection = msg.data as SelectionInfo;
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
    if ($progress) $progress.classList.add("visible");
    if ($progressText) $progressText.textContent = "Processing image…";

    const processed = await applyAdjToImageBytes(
      msg.bytes as Uint8Array,
      adj
    );
    pendingImages.set(key, processed);

    if ($progress) $progress.classList.remove("visible");

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
  if (currentSelection.count === 0) return;

  const btn = $<HTMLButtonElement>("btn-apply")!;
  btn.disabled = true;
  btn.textContent = "Applying…";

  // Re-process images with current adjustments
  const imageFills = currentSelection.fills.filter(
    (f) => f.fillType === "IMAGE" && f.imageHash
  );
  if (imageFills.length > 0) {
    const $progress = $("img-progress");
    const $progressText = $("img-progress-text");
    if ($progress) $progress.classList.add("visible");

    for (let i = 0; i < imageFills.length; i++) {
      const fill = imageFills[i];
      if ($progressText)
        $progressText.textContent = `Processing image ${i + 1}/${imageFills.length}…`;

      // Request fresh bytes
      parent.postMessage(
        {
          pluginMessage: {
            type: "request-image",
            nodeId: fill.nodeId,
            fillIndex: fill.fillIndex,
            imageHash: fill.imageHash,
          },
        },
        "*"
      );
      // Wait for bytes to arrive (handled in message listener)
      // For simplicity, we use a short polling approach here
      // In production this should use proper async coordination
    }
    if ($progress) $progress.classList.remove("visible");
  }

  const changes = buildChanges();
  parent.postMessage(
    { pluginMessage: { type: "apply-changes", changes, permanent: true } },
    "*"
  );

  btn.textContent = "Apply to Selection";
  btn.disabled = currentSelection.count === 0;
});

// ============================================================
// Bootstrap
// ============================================================

function init(): void {
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
