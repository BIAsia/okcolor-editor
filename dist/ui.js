// src/color.ts
var clamp01 = (v) => Math.min(1, Math.max(0, v));
var deg2rad = (d) => d * Math.PI / 180;
var rad2deg = (r) => r * 180 / Math.PI;
function srgbToLinear(v) {
  const c2 = clamp01(v);
  return c2 <= 0.04045 ? c2 / 12.92 : Math.pow((c2 + 0.055) / 1.055, 2.4);
}
function linearToSrgb(v) {
  return v <= 31308e-7 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
}
function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b2 = srgbToLinear(rgb.b);
  const l2 = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b2;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b2;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b2;
  const l_ = Math.cbrt(l2);
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
  const l2 = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const rLin = 4.0767416621 * l2 - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l2 + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l2 - 0.7034186147 * m + 1.707614701 * s;
  return {
    r: linearToSrgb(rLin),
    g: linearToSrgb(gLin),
    b: linearToSrgb(bLin)
  };
}
function oklabToRgb(lab) {
  const raw = oklabToRgbUnclamped(lab);
  return {
    r: clamp01(raw.r),
    g: clamp01(raw.g),
    b: clamp01(raw.b)
  };
}
function oklabToOklch(lab) {
  const c2 = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h2 = rad2deg(Math.atan2(lab.b, lab.a));
  if (h2 < 0) h2 += 360;
  return { l: lab.l, c: c2, h: h2 };
}
function oklchToOklab(lch) {
  const hr = deg2rad(lch.h);
  return {
    l: lch.l,
    a: lch.c * Math.cos(hr),
    b: lch.c * Math.sin(hr)
  };
}
function mixOklch(a2, b2, t2) {
  const x = Math.min(1, Math.max(0, t2));
  const dh = ((b2.h - a2.h) % 360 + 540) % 360 - 180;
  return {
    l: a2.l + (b2.l - a2.l) * x,
    c: a2.c + (b2.c - a2.c) * x,
    h: (a2.h + dh * x + 360) % 360
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
      const t2 = (x - p0.x) / Math.max(1e-6, p1.x - p0.x);
      return clamp01(p0.y + (p1.y - p0.y) * t2);
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
function gradientRampFromStops(stops, steps) {
  const count = Math.max(2, Math.floor(steps));
  const normalizedStops = stops.slice().map((stop) => ({
    position: clamp01(stop.position),
    color: stop.color
  })).sort((left, right) => left.position - right.position);
  if (normalizedStops.length < 2) {
    const fallback = normalizedStops[0]?.color ?? { r: 0, g: 0, b: 0 };
    return Array.from({ length: count }, () => Object.assign({}, fallback));
  }
  const anchoredStops = normalizedStops.slice();
  if (anchoredStops[0].position > 0) {
    anchoredStops.unshift({ position: 0, color: anchoredStops[0].color });
  }
  if (anchoredStops[anchoredStops.length - 1].position < 1) {
    anchoredStops.push({ position: 1, color: anchoredStops[anchoredStops.length - 1].color });
  }
  const lchStops = anchoredStops.map((stop) => ({
    position: stop.position,
    lch: oklabToOklch(rgbToOklab(stop.color))
  }));
  const out = [];
  for (let i = 0; i < count; i++) {
    const t2 = i / (count - 1);
    let rightIndex = lchStops.findIndex((stop) => t2 <= stop.position);
    if (rightIndex === -1) {
      rightIndex = lchStops.length - 1;
    }
    if (rightIndex === 0) {
      out.push(oklabToRgb(oklchToOklab(lchStops[0].lch)));
      continue;
    }
    const left = lchStops[rightIndex - 1];
    const right = lchStops[rightIndex];
    const segmentSpan = Math.max(1e-6, right.position - left.position);
    const localT = clamp01((t2 - left.position) / segmentSpan);
    out.push(oklabToRgb(oklchToOklab(mixOklch(left.lch, right.lch, localT))));
  }
  return out;
}

// ui/ui.ts
var byId = (id) => document.getElementById(id);
var l = byId("l");
var a = byId("a");
var b = byId("b");
var c = byId("c");
var h = byId("h");
var maskFeather = byId("maskFeather");
var maskLMin = byId("maskLMin");
var maskLMax = byId("maskLMax");
var maskCMin = byId("maskCMin");
var maskCMax = byId("maskCMax");
var maskHint = byId("maskHint");
var maskScope = byId("maskScope");
var locale = byId("locale");
var curvePack = byId("curvePack");
var curvePreset = byId("curvePreset");
var curveMid = byId("curveMid");
var curveMidA = byId("curveMidA");
var curveMidB = byId("curveMidB");
var curveEditor = byId("curveEditor");
var curveHint = byId("curveHint");
var gradPalette = byId("gradPalette");
var gradStartColor = byId("gradStartColor");
var gradMidPos = byId("gradMidPos");
var gradMidColor = byId("gradMidColor");
var gradStop2Enabled = byId("gradStop2Enabled");
var gradStop2Pos = byId("gradStop2Pos");
var gradStop2Color = byId("gradStop2Color");
var gradStop4Enabled = byId("gradStop4Enabled");
var gradStop4Pos = byId("gradStop4Pos");
var gradStop4Color = byId("gradStop4Color");
var gradEndColor = byId("gradEndColor");
var gradPreview = byId("gradPreview");
var labHistogram = byId("labHistogram");
var labWaveform = byId("labWaveform");
var recipeList = byId("recipeList");
var recipeName = byId("recipeName");
var saveRecipeBtn = byId("saveRecipe");
var loadRecipeBtn = byId("loadRecipe");
var deleteRecipeBtn = byId("deleteRecipe");
var gamutPolicy = byId("gamutPolicy");
var gamutStatus = byId("gamutStatus");
var applyBtn = byId("apply");
var applyGradientBtn = byId("applyGradient");
var undoBtn = byId("undo");
var redoBtn = byId("redo");
var selectedColor = { r: 0.5, g: 0.5, b: 0.5 };
var historyLimit = 60;
var undoStack = [];
var redoStack = [];
var applyingHistory = false;
var lastState;
var PALETTES = {
  sunrise: { mid: "#f97316", end: "#fde047", midPos: "0.42" },
  ocean: { mid: "#06b6d4", end: "#2563eb", midPos: "0.48" },
  candy: { mid: "#ec4899", end: "#8b5cf6", midPos: "0.52" },
  complementary: { mid: "#16a34a", end: "#f97316", midPos: "0.50" }
};
var CURVE_PACKS = {
  contrast: { lPreset: "contrast", midA: "0.58", midB: "0.58" },
  filmic: { lPreset: "filmic", midA: "0.46", midB: "0.44" },
  "pastel-recover": { lPreset: "pastel-recover", midA: "0.52", midB: "0.52" }
};
var recipeStorageKey = "okcolor-edit:recipes:v1";
var localeStorageKey = "okcolor-edit:locale:v1";
var recipes = [];
var I18N = {
  en: {
    title: "okcolor edit",
    subtitle: "Oklab/Oklch conversion, gradient, curve, gamut policy",
    languageLabel: "Language",
    lShift: "L shift",
    aShift: "a shift",
    bShift: "b shift",
    cShift: "C shift",
    hShift: "H shift",
    maskFeatherLabel: "Mask feather",
    maskLRangeLabel: "L range min/max",
    maskCRangeLabel: "C range min/max",
    maskHintPrefix: "mask weight",
    maskScopeLabel: "Mask scope over gradient",
    curvePackLabel: "Curve pack",
    curvePackCustom: "custom",
    curvePresetLabel: "Curve preset (L channel)",
    curveCustom: "custom midpoint",
    curveContrast: "contrast",
    curveFilmic: "filmic",
    curvePastel: "pastel recover",
    curveMidLabel: "Curve midpoint (L, custom only)",
    curveMidALabel: "Curve midpoint (a, custom)",
    curveMidBLabel: "Curve midpoint (b, custom)",
    gradientPaletteLabel: "Gradient palette",
    paletteCustom: "custom",
    paletteSunrise: "sunrise",
    paletteOcean: "ocean",
    paletteCandy: "candy",
    paletteComplementary: "complementary",
    startStopLabel: "Start stop color",
    middlePosLabel: "Middle stop position",
    middleColorLabel: "Middle stop color",
    extraStop2Label: "Extra stop A",
    extraStop4Label: "Extra stop B",
    endStopLabel: "End stop color",
    recipesLabel: "Adjustment recipes",
    recipePlaceholder: "(select saved recipe)",
    load: "Load",
    delete: "Delete",
    recipeNameLabel: "Recipe name",
    recipeNamePlaceholder: "e.g. soft filmic teal",
    saveCurrent: "Save current settings",
    histogramLabel: "Oklab histogram (L/a/b)",
    waveformLabel: "Oklab waveform (L/a/b)",
    gamutPolicyLabel: "Gamut policy",
    gamutClip: "clip",
    gamutCompress: "compress",
    gamutWarn: "warn + clip",
    undo: "Undo",
    redo: "Redo",
    applySolid: "Apply solid",
    applyGradient: "Apply gradient",
    tip: "Tip: select a layer with SOLID fill first.",
    inGamut: "In gamut",
    outOfGamut: "Out-of-gamut handled by policy",
    curveHintPrefix: "curve"
  },
  "zh-CN": {
    title: "okcolor edit",
    subtitle: "Oklab/Oklch \u8F6C\u6362\u3001\u6E10\u53D8\u3001\u66F2\u7EBF\u3001\u8272\u57DF\u7B56\u7565",
    languageLabel: "\u8BED\u8A00",
    lShift: "L \u660E\u5EA6\u504F\u79FB",
    aShift: "a \u8F74\u504F\u79FB",
    bShift: "b \u8F74\u504F\u79FB",
    cShift: "C \u9971\u548C\u5EA6\u504F\u79FB",
    hShift: "H \u8272\u76F8\u504F\u79FB",
    maskFeatherLabel: "\u8499\u7248\u7FBD\u5316",
    maskLRangeLabel: "L \u8303\u56F4 \u6700\u5C0F/\u6700\u5927",
    maskCRangeLabel: "C \u8303\u56F4 \u6700\u5C0F/\u6700\u5927",
    maskHintPrefix: "\u8499\u7248\u6743\u91CD",
    maskScopeLabel: "\u6E10\u53D8\u4E0A\u7684\u8499\u7248\u8986\u76D6",
    curvePackLabel: "\u66F2\u7EBF\u7EC4\u5408\u5305",
    curvePackCustom: "\u81EA\u5B9A\u4E49",
    curvePresetLabel: "\u66F2\u7EBF\u9884\u8BBE\uFF08L \u901A\u9053\uFF09",
    curveCustom: "\u81EA\u5B9A\u4E49\u4E2D\u70B9",
    curveContrast: "\u5BF9\u6BD4\u589E\u5F3A",
    curveFilmic: "\u7535\u5F71\u611F",
    curvePastel: "\u7C89\u5F69\u6062\u590D",
    curveMidLabel: "\u66F2\u7EBF\u4E2D\u70B9\uFF08L\uFF0C\u4EC5\u81EA\u5B9A\u4E49\uFF09",
    curveMidALabel: "\u66F2\u7EBF\u4E2D\u70B9\uFF08a\uFF0C\u81EA\u5B9A\u4E49\uFF09",
    curveMidBLabel: "\u66F2\u7EBF\u4E2D\u70B9\uFF08b\uFF0C\u81EA\u5B9A\u4E49\uFF09",
    gradientPaletteLabel: "\u6E10\u53D8\u8272\u677F",
    paletteCustom: "\u81EA\u5B9A\u4E49",
    paletteSunrise: "\u65E5\u51FA",
    paletteOcean: "\u6D77\u6D0B",
    paletteCandy: "\u7CD6\u679C",
    paletteComplementary: "\u4E92\u8865",
    startStopLabel: "\u8D77\u70B9\u989C\u8272",
    middlePosLabel: "\u4E2D\u95F4\u70B9\u4F4D\u7F6E",
    middleColorLabel: "\u4E2D\u95F4\u70B9\u989C\u8272",
    extraStop2Label: "\u989D\u5916\u8282\u70B9 A",
    extraStop4Label: "\u989D\u5916\u8282\u70B9 B",
    endStopLabel: "\u7EC8\u70B9\u989C\u8272",
    recipesLabel: "\u8C03\u6574\u914D\u65B9",
    recipePlaceholder: "\uFF08\u9009\u62E9\u5DF2\u4FDD\u5B58\u914D\u65B9\uFF09",
    load: "\u52A0\u8F7D",
    delete: "\u5220\u9664",
    recipeNameLabel: "\u914D\u65B9\u540D\u79F0",
    recipeNamePlaceholder: "\u4F8B\u5982\uFF1A\u67D4\u548C\u7535\u5F71\u611F\u9752\u8272",
    saveCurrent: "\u4FDD\u5B58\u5F53\u524D\u8BBE\u7F6E",
    histogramLabel: "Oklab \u76F4\u65B9\u56FE\uFF08L/a/b\uFF09",
    waveformLabel: "Oklab \u6CE2\u5F62\u56FE\uFF08L/a/b\uFF09",
    gamutPolicyLabel: "\u8272\u57DF\u7B56\u7565",
    gamutClip: "\u88C1\u526A",
    gamutCompress: "\u538B\u7F29",
    gamutWarn: "\u8B66\u544A + \u88C1\u526A",
    undo: "\u64A4\u9500",
    redo: "\u91CD\u505A",
    applySolid: "\u5E94\u7528\u7EAF\u8272",
    applyGradient: "\u5E94\u7528\u6E10\u53D8",
    tip: "\u63D0\u793A\uFF1A\u5148\u9009\u62E9\u5E26\u6709 SOLID \u586B\u5145\u7684\u56FE\u5C42\u3002",
    inGamut: "\u8272\u57DF\u5185",
    outOfGamut: "\u8D85\u51FA\u8272\u57DF\uFF0C\u5DF2\u6309\u7B56\u7565\u5904\u7406",
    curveHintPrefix: "\u66F2\u7EBF"
  }
};
var currentLocale = "en";
function captureState() {
  return {
    l: l.value,
    a: a.value,
    b: b.value,
    c: c.value,
    h: h.value,
    maskFeather: maskFeather.value,
    maskLMin: maskLMin.value,
    maskLMax: maskLMax.value,
    maskCMin: maskCMin.value,
    maskCMax: maskCMax.value,
    curvePack: curvePack.value,
    curvePreset: curvePreset.value,
    curveMid: curveMid.value,
    curveMidA: curveMidA.value,
    curveMidB: curveMidB.value,
    gradPalette: gradPalette.value,
    gradStartColor: gradStartColor.value,
    gradMidPos: gradMidPos.value,
    gradMidColor: gradMidColor.value,
    gradStop2Enabled: gradStop2Enabled.checked ? "1" : "0",
    gradStop2Pos: gradStop2Pos.value,
    gradStop2Color: gradStop2Color.value,
    gradStop4Enabled: gradStop4Enabled.checked ? "1" : "0",
    gradStop4Pos: gradStop4Pos.value,
    gradStop4Color: gradStop4Color.value,
    gradEndColor: gradEndColor.value,
    gamutPolicy: gamutPolicy.value
  };
}
function statesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function resolveLocale(candidate) {
  return candidate === "zh-CN" ? "zh-CN" : "en";
}
function t(key) {
  return I18N[currentLocale][key];
}
function applyLocale(localeId) {
  currentLocale = localeId;
  localStorage.setItem(localeStorageKey, localeId);
  locale.value = localeId;
  const textNodes = document.querySelectorAll("[data-i18n]");
  for (const node of textNodes) {
    const key = node.dataset.i18n;
    if (!key) continue;
    node.textContent = t(key);
  }
  const placeholderNodes = document.querySelectorAll("[data-i18n-placeholder]");
  for (const node of placeholderNodes) {
    const key = node.dataset.i18nPlaceholder;
    if (!key) continue;
    node.placeholder = t(key);
  }
  renderRecipeOptions(recipeList.value);
  refreshStatus();
}
function setControls(state) {
  l.value = state.l;
  a.value = state.a;
  b.value = state.b;
  c.value = state.c;
  h.value = state.h;
  maskFeather.value = state.maskFeather;
  maskLMin.value = state.maskLMin;
  maskLMax.value = state.maskLMax;
  maskCMin.value = state.maskCMin;
  maskCMax.value = state.maskCMax;
  curvePack.value = state.curvePack;
  curvePreset.value = state.curvePreset;
  curveMid.value = state.curveMid;
  curveMidA.value = state.curveMidA;
  curveMidB.value = state.curveMidB;
  gradPalette.value = state.gradPalette;
  gradStartColor.value = state.gradStartColor;
  gradMidPos.value = state.gradMidPos;
  gradMidColor.value = state.gradMidColor;
  gradStop2Enabled.checked = state.gradStop2Enabled === "1";
  gradStop2Pos.value = state.gradStop2Pos;
  gradStop2Color.value = state.gradStop2Color;
  gradStop4Enabled.checked = state.gradStop4Enabled === "1";
  gradStop4Pos.value = state.gradStop4Pos;
  gradStop4Color.value = state.gradStop4Color;
  gradEndColor.value = state.gradEndColor;
  gamutPolicy.value = state.gamutPolicy;
}
function updateHistoryButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}
function normalizeRecipeState(state) {
  const fallback = captureState();
  return Object.assign({}, fallback, state, {
    curvePack: typeof state?.curvePack === "string" ? state.curvePack : fallback.curvePack,
    curveMidA: typeof state?.curveMidA === "string" ? state.curveMidA : fallback.curveMidA,
    curveMidB: typeof state?.curveMidB === "string" ? state.curveMidB : fallback.curveMidB
  });
}
function loadRecipes() {
  try {
    const raw = localStorage.getItem(recipeStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((recipe) => Boolean(recipe?.name) && Boolean(recipe?.state)).map((recipe) => Object.assign({}, recipe, {
      state: normalizeRecipeState(recipe.state)
    }));
  } catch {
    return [];
  }
}
function persistRecipes() {
  localStorage.setItem(recipeStorageKey, JSON.stringify(recipes));
}
function renderRecipeOptions(selectedName = "") {
  recipeList.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("recipePlaceholder");
  recipeList.appendChild(placeholder);
  for (const recipe of recipes) {
    const option = document.createElement("option");
    option.value = recipe.name;
    option.textContent = recipe.name;
    if (recipe.name === selectedName) {
      option.selected = true;
    }
    recipeList.appendChild(option);
  }
  const hasSelection = recipeList.value !== "";
  loadRecipeBtn.disabled = !hasSelection;
  deleteRecipeBtn.disabled = !hasSelection;
}
function saveCurrentRecipe() {
  const name = recipeName.value.trim();
  if (!name) {
    return;
  }
  const now = Date.now();
  const state = captureState();
  const existingIndex = recipes.findIndex((recipe) => recipe.name === name);
  const nextRecipe = { name, state, updatedAt: now };
  if (existingIndex >= 0) {
    recipes[existingIndex] = nextRecipe;
  } else {
    recipes.push(nextRecipe);
  }
  recipes.sort((left, right) => right.updatedAt - left.updatedAt);
  persistRecipes();
  renderRecipeOptions(name);
}
function loadSelectedRecipe() {
  const selectedName = recipeList.value;
  if (!selectedName) return;
  const selected = recipes.find((recipe) => recipe.name === selectedName);
  if (!selected) return;
  applyHistoryState(selected.state);
  recipeName.value = selected.name;
}
function deleteSelectedRecipe() {
  const selectedName = recipeList.value;
  if (!selectedName) return;
  recipes = recipes.filter((recipe) => recipe.name !== selectedName);
  persistRecipes();
  renderRecipeOptions();
  recipeName.value = "";
}
function rgbToHex(rgb) {
  const r = Math.round(Math.min(1, Math.max(0, rgb.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, rgb.g)) * 255);
  const b2 = Math.round(Math.min(1, Math.max(0, rgb.b)) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b2.toString(16).padStart(2, "0")}`;
}
function hexToRgb(hex) {
  const normalized = hex.replace("#", "").trim();
  const parsed = Number.parseInt(normalized, 16);
  const r = (parsed >> 16 & 255) / 255;
  const g = (parsed >> 8 & 255) / 255;
  const b2 = (parsed & 255) / 255;
  return { r, g, b: b2 };
}
function applyPalette(paletteId) {
  const preset = PALETTES[paletteId];
  if (!preset) return;
  gradMidColor.value = preset.mid;
  gradEndColor.value = preset.end;
  gradMidPos.value = preset.midPos;
  gradStop2Enabled.checked = false;
  gradStop4Enabled.checked = false;
}
parent.postMessage({ pluginMessage: { type: "request-selection-color" } }, "*");
window.onmessage = (evt) => {
  const msg = evt.data.pluginMessage;
  if (msg?.type === "selection-color" && msg.color) {
    selectedColor = msg.color;
    const editedBase = computeEditedColor().rgb;
    gradStartColor.value = rgbToHex(editedBase);
    if (gradPalette.value !== "custom") {
      applyPalette(gradPalette.value);
    }
    renderGradientPreview();
  }
};
function applyCurvePack(packId) {
  if (packId === "custom") {
    curvePreset.value = "custom";
    return;
  }
  const pack = CURVE_PACKS[packId];
  if (!pack) return;
  curvePreset.value = pack.lPreset;
  curveMidA.value = pack.midA;
  curveMidB.value = pack.midB;
}
function getLumaCurve() {
  const preset = curvePreset.value;
  if (preset === "custom") {
    const mid = Number(curveMid.value);
    return [
      { x: 0, y: 0 },
      { x: 0.5, y: mid },
      { x: 1, y: 1 }
    ];
  }
  return getCurvePreset(preset);
}
function getAxisCurve(mid) {
  return [
    { x: 0, y: 0 },
    { x: 0.5, y: mid },
    { x: 1, y: 1 }
  ];
}
function curveLabel(points) {
  return points.map((point) => `(${point.x.toFixed(2)},${point.y.toFixed(2)})`).join(" -> ");
}
function drawCurveLine(ctx, points, color, width, height, pad) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  points.forEach((point, index) => {
    const x = pad + point.x * (width - pad * 2);
    const y = height - pad - point.y * (height - pad * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}
function drawCurveHandle(ctx, x, y, color, active) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.globalAlpha = active ? 1 : 0.75;
  ctx.arc(x, y, active ? 6 : 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
function renderCurveEditor(activeChannel = null) {
  const ctx = curveEditor.getContext("2d");
  if (!ctx) return;
  const width = curveEditor.width;
  const height = curveEditor.height;
  const pad = 10;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#ece5da";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const x = pad + (width - pad * 2) * i / 4;
    const y = pad + (height - pad * 2) * i / 4;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, height - pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
  const curveL = getLumaCurve();
  const curveA = getAxisCurve(Number(curveMidA.value));
  const curveB = getAxisCurve(Number(curveMidB.value));
  drawCurveLine(ctx, curveL, "#2563eb", width, height, pad);
  drawCurveLine(ctx, curveA, "#16a34a", width, height, pad);
  drawCurveLine(ctx, curveB, "#dc2626", width, height, pad);
  const handleY = (value) => height - pad - value * (height - pad * 2);
  const handleX = pad + 0.5 * (width - pad * 2);
  drawCurveHandle(ctx, handleX, handleY(Number(curveMid.value)), "#2563eb", activeChannel === "l");
  drawCurveHandle(ctx, handleX, handleY(Number(curveMidA.value)), "#16a34a", activeChannel === "a");
  drawCurveHandle(ctx, handleX, handleY(Number(curveMidB.value)), "#dc2626", activeChannel === "b");
}
function computeEditedColor() {
  const baseLab = rgbToOklab(selectedColor);
  const baseLch = oklabToOklch(baseLab);
  const maskConfig = getMaskConfig();
  const maskWeight = computeRegionMaskWeight(baseLch, maskConfig);
  const deltaLab = {
    l: Number(l.value) * maskWeight,
    a: Number(a.value) * maskWeight,
    b: Number(b.value) * maskWeight
  };
  const shiftedLab = {
    l: baseLab.l + deltaLab.l,
    a: baseLab.a + deltaLab.a,
    b: baseLab.b + deltaLab.b
  };
  const shiftedLch = oklabToOklch(shiftedLab);
  const adjustedLch = {
    l: shiftedLch.l,
    c: Math.max(0, shiftedLch.c + Number(c.value) * maskWeight),
    h: (shiftedLch.h + Number(h.value) * maskWeight + 360) % 360
  };
  const labAfterLch = oklchToOklab(adjustedLch);
  const curveL = getLumaCurve();
  const curveA = getAxisCurve(Number(curveMidA.value));
  const curveB = getAxisCurve(Number(curveMidB.value));
  const normA = (labAfterLch.a + 0.4) / 0.8;
  const normB = (labAfterLch.b + 0.4) / 0.8;
  const labAfterCurve = {
    l: applyCurve(labAfterLch.l, curveL),
    a: applyCurve(normA, curveA) * 0.8 - 0.4,
    b: applyCurve(normB, curveB) * 0.8 - 0.4
  };
  const rawRgb = oklabToRgbUnclamped(labAfterCurve);
  const gamut = enforceGamut(rawRgb, gamutPolicy.value);
  return Object.assign({}, gamut, { maskWeight });
}
function getGradientStops() {
  const stops = [
    { position: 0, color: hexToRgb(gradStartColor.value) },
    { position: Number(gradMidPos.value), color: hexToRgb(gradMidColor.value) },
    { position: 1, color: hexToRgb(gradEndColor.value) }
  ];
  if (gradStop2Enabled.checked) {
    stops.push({ position: Number(gradStop2Pos.value), color: hexToRgb(gradStop2Color.value) });
  }
  if (gradStop4Enabled.checked) {
    stops.push({ position: Number(gradStop4Pos.value), color: hexToRgb(gradStop4Color.value) });
  }
  stops.sort((left, right) => left.position - right.position);
  return stops;
}
function renderGradientPreview() {
  const ctx = gradPreview.getContext("2d");
  if (!ctx) return;
  const ramp = gradientRampFromStops(getGradientStops(), 24);
  const step = gradPreview.width / ramp.length;
  for (let i = 0; i < ramp.length; i++) {
    const v = ramp[i];
    ctx.fillStyle = `rgb(${Math.round(v.r * 255)} ${Math.round(v.g * 255)} ${Math.round(v.b * 255)})`;
    ctx.fillRect(i * step, 0, Math.ceil(step), gradPreview.height);
  }
}
function getRampOklabSamples(sampleCount = 64) {
  return gradientRampFromStops(getGradientStops(), sampleCount).map((rgb) => rgbToOklab(rgb));
}
function renderLabHistogram() {
  const ctx = labHistogram.getContext("2d");
  if (!ctx) return;
  const width = labHistogram.width;
  const height = labHistogram.height;
  const bins = 24;
  const channels = {
    l: new Array(bins).fill(0),
    a: new Array(bins).fill(0),
    b: new Array(bins).fill(0)
  };
  for (const sample of getRampOklabSamples()) {
    channels.l[Math.min(bins - 1, Math.max(0, Math.floor(sample.l * bins)))] += 1;
    channels.a[Math.min(bins - 1, Math.max(0, Math.floor((sample.a + 0.4) / 0.8 * bins)))] += 1;
    channels.b[Math.min(bins - 1, Math.max(0, Math.floor((sample.b + 0.4) / 0.8 * bins)))] += 1;
  }
  const maxBin = Math.max.apply(null, [1].concat(channels.l, channels.a, channels.b));
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const barWidth = width / bins;
  const drawChannel = (values, color) => {
    ctx.fillStyle = color;
    for (let i = 0; i < bins; i++) {
      const normalized = values[i] / maxBin;
      const barHeight = normalized * (height - 4);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(i * barWidth + 1, height - barHeight - 2, Math.max(1, barWidth - 2), barHeight);
    }
    ctx.globalAlpha = 1;
  };
  drawChannel(channels.l, "#2563eb");
  drawChannel(channels.a, "#16a34a");
  drawChannel(channels.b, "#dc2626");
}
function renderLabWaveform() {
  const ctx = labWaveform.getContext("2d");
  if (!ctx) return;
  const width = labWaveform.width;
  const height = labWaveform.height;
  const samples = getRampOklabSamples();
  const lastIndex = Math.max(1, samples.length - 1);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const drawLine = (mapY, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < samples.length; i++) {
      const x = i / lastIndex * width;
      const y = mapY(samples[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };
  drawLine((sample) => height - sample.l * (height - 1), "#2563eb");
  drawLine((sample) => height - (sample.a + 0.4) / 0.8 * (height - 1), "#16a34a");
  drawLine((sample) => height - (sample.b + 0.4) / 0.8 * (height - 1), "#dc2626");
}
function getMaskConfig() {
  return {
    lMin: Math.min(Number(maskLMin.value), Number(maskLMax.value)),
    lMax: Math.max(Number(maskLMin.value), Number(maskLMax.value)),
    cMin: Math.min(Number(maskCMin.value), Number(maskCMax.value)),
    cMax: Math.max(Number(maskCMin.value), Number(maskCMax.value)),
    feather: Number(maskFeather.value)
  };
}
function renderMaskScope(weights) {
  const ctx = maskScope.getContext("2d");
  if (!ctx) return;
  const width = maskScope.width;
  const height = maskScope.height;
  const count = Math.max(1, weights.length);
  const step = width / count;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < count; i++) {
    const weight = Math.min(1, Math.max(0, weights[i] ?? 0));
    const barHeight = weight * (height - 6);
    const alpha = 0.2 + weight * 0.75;
    ctx.fillStyle = `rgba(31, 122, 109, ${alpha.toFixed(3)})`;
    ctx.fillRect(i * step, height - barHeight - 3, Math.max(1, Math.ceil(step)), barHeight);
  }
  ctx.strokeStyle = "#ddd5c8";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}
function refreshExtraStopControls() {
  gradStop2Pos.disabled = !gradStop2Enabled.checked;
  gradStop2Color.disabled = !gradStop2Enabled.checked;
  gradStop4Pos.disabled = !gradStop4Enabled.checked;
  gradStop4Color.disabled = !gradStop4Enabled.checked;
}
function refreshStatus() {
  const edited = computeEditedColor();
  const policy = gamutPolicy.value;
  if (edited.clipped) {
    gamutStatus.textContent = `${t("outOfGamut")}: ${policy}`;
    gamutStatus.className = "small warn";
  } else {
    gamutStatus.textContent = t("inGamut");
    gamutStatus.className = "small";
  }
  const curvePointsL = getLumaCurve();
  const curvePointsA = getAxisCurve(Number(curveMidA.value));
  const curvePointsB = getAxisCurve(Number(curveMidB.value));
  curveHint.textContent = `${t("curveHintPrefix")} L: ${curveLabel(curvePointsL)} | a: ${curveLabel(curvePointsA)} | b: ${curveLabel(curvePointsB)}`;
  curveMid.disabled = curvePreset.value !== "custom";
  const maskConfig = getMaskConfig();
  const maskWeights = getRampOklabSamples().map(
    (sample) => computeRegionMaskWeight(oklabToOklch(sample), maskConfig)
  );
  const maskAverage = maskWeights.reduce((sum, weight) => sum + weight, 0) / Math.max(1, maskWeights.length);
  maskHint.textContent = `${t("maskHintPrefix")}: ${edited.maskWeight.toFixed(2)} | avg ${maskAverage.toFixed(2)}`;
  if (gradPalette.value === "custom") {
    gradStartColor.value = rgbToHex(edited.rgb);
  }
  refreshExtraStopControls();
  renderGradientPreview();
  renderLabHistogram();
  renderLabWaveform();
  renderMaskScope(maskWeights);
  renderCurveEditor();
}
function applyHistoryState(state) {
  applyingHistory = true;
  setControls(state);
  if (gradPalette.value !== "custom") {
    applyPalette(gradPalette.value);
  }
  refreshStatus();
  lastState = captureState();
  applyingHistory = false;
  updateHistoryButtons();
}
function pushUndo(state) {
  undoStack.push(state);
  if (undoStack.length > historyLimit) {
    undoStack.shift();
  }
}
function undo() {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(lastState);
  applyHistoryState(previous);
}
function redo() {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(lastState);
  applyHistoryState(next);
}
[l, a, b, c, h, maskFeather, maskLMin, maskLMax, maskCMin, maskCMax, curvePack, curvePreset, curveMid, curveMidA, curveMidB, gradPalette, gradStartColor, gradMidPos, gradMidColor, gradStop2Enabled, gradStop2Pos, gradStop2Color, gradStop4Enabled, gradStop4Pos, gradStop4Color, gradEndColor, gamutPolicy].forEach((node) => {
  node.addEventListener("input", () => {
    if (applyingHistory) return;
    const before = lastState;
    if (node === gradPalette && gradPalette.value !== "custom") {
      applyPalette(gradPalette.value);
    }
    if (node === curvePack) {
      applyCurvePack(curvePack.value);
    }
    if (node === curvePreset && curvePack.value !== "custom") {
      curvePack.value = "custom";
    }
    refreshStatus();
    const after = captureState();
    if (!statesEqual(before, after)) {
      pushUndo(before);
      redoStack.length = 0;
      lastState = after;
      updateHistoryButtons();
    }
  });
  node.addEventListener("change", () => {
    if (applyingHistory) return;
    refreshStatus();
  });
});
undoBtn.onclick = undo;
redoBtn.onclick = redo;
recipeList.onchange = () => {
  const selected = recipes.find((recipe) => recipe.name === recipeList.value);
  recipeName.value = selected?.name ?? "";
  const hasSelection = recipeList.value !== "";
  loadRecipeBtn.disabled = !hasSelection;
  deleteRecipeBtn.disabled = !hasSelection;
};
saveRecipeBtn.onclick = saveCurrentRecipe;
loadRecipeBtn.onclick = loadSelectedRecipe;
deleteRecipeBtn.onclick = deleteSelectedRecipe;
locale.onchange = () => {
  applyLocale(resolveLocale(locale.value));
};
window.addEventListener("keydown", (evt) => {
  const isUndo = (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key.toLowerCase() === "z";
  const isRedo = (evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "y" || (evt.ctrlKey || evt.metaKey) && evt.shiftKey && evt.key.toLowerCase() === "z";
  if (isUndo) {
    evt.preventDefault();
    undo();
  }
  if (isRedo) {
    evt.preventDefault();
    redo();
  }
});
var draggingChannel = null;
function findCurveChannelByY(y) {
  const mids = [
    { id: "l", value: Number(curveMid.value) },
    { id: "a", value: Number(curveMidA.value) },
    { id: "b", value: Number(curveMidB.value) }
  ];
  const pad = 10;
  const h2 = curveEditor.height;
  const targetValue = (h2 - pad - y) / Math.max(1, h2 - pad * 2);
  return mids.sort((left, right) => Math.abs(left.value - targetValue) - Math.abs(right.value - targetValue))[0].id;
}
function updateCurveMidpointFromPointer(evt) {
  const rect = curveEditor.getBoundingClientRect();
  const y = evt.clientY - rect.top;
  const pad = 10;
  const normalized = Math.min(1, Math.max(0, (curveEditor.height - pad - y) / (curveEditor.height - pad * 2)));
  if (draggingChannel === "l") curveMid.value = normalized.toFixed(2);
  if (draggingChannel === "a") curveMidA.value = normalized.toFixed(2);
  if (draggingChannel === "b") curveMidB.value = normalized.toFixed(2);
  refreshStatus();
  const after = captureState();
  if (!statesEqual(lastState, after)) {
    lastState = after;
  }
  renderCurveEditor(draggingChannel);
}
curveEditor.addEventListener("pointerdown", (evt) => {
  const rect = curveEditor.getBoundingClientRect();
  const localY = evt.clientY - rect.top;
  const before = lastState;
  draggingChannel = findCurveChannelByY(localY);
  curvePack.value = "custom";
  curvePreset.value = "custom";
  pushUndo(before);
  redoStack.length = 0;
  updateHistoryButtons();
  curveEditor.setPointerCapture(evt.pointerId);
  updateCurveMidpointFromPointer(evt);
});
curveEditor.addEventListener("pointermove", (evt) => {
  if (!draggingChannel) return;
  updateCurveMidpointFromPointer(evt);
});
var stopCurveDrag = (evt) => {
  if (!draggingChannel) return;
  draggingChannel = null;
  curveEditor.releasePointerCapture(evt.pointerId);
  renderCurveEditor();
};
curveEditor.addEventListener("pointerup", stopCurveDrag);
curveEditor.addEventListener("pointercancel", stopCurveDrag);
applyBtn.onclick = () => {
  parent.postMessage({
    pluginMessage: {
      type: "apply-solid-adjustment",
      settings: {
        l: Number(l.value),
        a: Number(a.value),
        b: Number(b.value),
        c: Number(c.value),
        h: Number(h.value),
        curvePreset: curvePreset.value,
        curveMid: Number(curveMid.value),
        curveMidA: Number(curveMidA.value),
        curveMidB: Number(curveMidB.value),
        gamutPolicy: gamutPolicy.value,
        mask: getMaskConfig()
      }
    }
  }, "*");
};
applyGradientBtn.onclick = () => {
  parent.postMessage({ pluginMessage: { type: "apply-gradient", stops: getGradientStops() } }, "*");
};
var initialEdited = computeEditedColor().rgb;
gradStartColor.value = rgbToHex(initialEdited);
gradMidColor.value = "#14b8a6";
gradEndColor.value = "#6366f1";
recipes = loadRecipes();
var storedLocale = resolveLocale(localStorage.getItem(localeStorageKey));
applyLocale(storedLocale);
lastState = captureState();
updateHistoryButtons();
