import {
  applyCurve,
  enforceGamut,
  getCurvePreset,
  gradientRampFromStops,
  computeRegionMaskWeight,
  oklabToOklch,
  oklabToRgbUnclamped,
  oklchToOklab,
  rgbToOklab,
  type CurvePoint,
  type CurvePresetId,
  type GamutPolicy,
  type RGB
} from "../src/color";

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const l = byId<HTMLInputElement>("l");
const a = byId<HTMLInputElement>("a");
const b = byId<HTMLInputElement>("b");
const c = byId<HTMLInputElement>("c");
const h = byId<HTMLInputElement>("h");
const maskFeather = byId<HTMLInputElement>("maskFeather");
const maskLMin = byId<HTMLInputElement>("maskLMin");
const maskLMax = byId<HTMLInputElement>("maskLMax");
const maskCMin = byId<HTMLInputElement>("maskCMin");
const maskCMax = byId<HTMLInputElement>("maskCMax");
const maskHint = byId<HTMLDivElement>("maskHint");
const maskScope = byId<HTMLCanvasElement>("maskScope");
const locale = byId<HTMLSelectElement>("locale");
const curvePack = byId<HTMLSelectElement>("curvePack");
const curvePreset = byId<HTMLSelectElement>("curvePreset");
const curveMid = byId<HTMLInputElement>("curveMid");
const curveMidA = byId<HTMLInputElement>("curveMidA");
const curveMidB = byId<HTMLInputElement>("curveMidB");
const curveHint = byId<HTMLDivElement>("curveHint");
const gradPalette = byId<HTMLSelectElement>("gradPalette");
const gradStartColor = byId<HTMLInputElement>("gradStartColor");
const gradMidPos = byId<HTMLInputElement>("gradMidPos");
const gradMidColor = byId<HTMLInputElement>("gradMidColor");
const gradStop2Enabled = byId<HTMLInputElement>("gradStop2Enabled");
const gradStop2Pos = byId<HTMLInputElement>("gradStop2Pos");
const gradStop2Color = byId<HTMLInputElement>("gradStop2Color");
const gradStop4Enabled = byId<HTMLInputElement>("gradStop4Enabled");
const gradStop4Pos = byId<HTMLInputElement>("gradStop4Pos");
const gradStop4Color = byId<HTMLInputElement>("gradStop4Color");
const gradEndColor = byId<HTMLInputElement>("gradEndColor");
const gradPreview = byId<HTMLCanvasElement>("gradPreview");
const labHistogram = byId<HTMLCanvasElement>("labHistogram");
const labWaveform = byId<HTMLCanvasElement>("labWaveform");
const recipeList = byId<HTMLSelectElement>("recipeList");
const recipeName = byId<HTMLInputElement>("recipeName");
const saveRecipeBtn = byId<HTMLButtonElement>("saveRecipe");
const loadRecipeBtn = byId<HTMLButtonElement>("loadRecipe");
const deleteRecipeBtn = byId<HTMLButtonElement>("deleteRecipe");
const gamutPolicy = byId<HTMLSelectElement>("gamutPolicy");
const gamutStatus = byId<HTMLDivElement>("gamutStatus");
const applyBtn = byId<HTMLButtonElement>("apply");
const applyGradientBtn = byId<HTMLButtonElement>("applyGradient");
const undoBtn = byId<HTMLButtonElement>("undo");
const redoBtn = byId<HTMLButtonElement>("redo");

let selectedColor: RGB = { r: 0.5, g: 0.5, b: 0.5 };

type UiState = {
  l: string;
  a: string;
  b: string;
  c: string;
  h: string;
  maskFeather: string;
  maskLMin: string;
  maskLMax: string;
  maskCMin: string;
  maskCMax: string;
  curvePack: Exclude<CurvePresetId, "custom"> | "custom";
  curvePreset: CurvePresetId;
  curveMid: string;
  curveMidA: string;
  curveMidB: string;
  gradPalette: string;
  gradStartColor: string;
  gradMidPos: string;
  gradMidColor: string;
  gradStop2Enabled: string;
  gradStop2Pos: string;
  gradStop2Color: string;
  gradStop4Enabled: string;
  gradStop4Pos: string;
  gradStop4Color: string;
  gradEndColor: string;
  gamutPolicy: GamutPolicy;
};

type SavedRecipe = {
  name: string;
  state: UiState;
  updatedAt: number;
};

const historyLimit = 60;
const undoStack: UiState[] = [];
const redoStack: UiState[] = [];
let applyingHistory = false;
let lastState: UiState;

const PALETTES: Record<string, { mid: string; end: string; midPos: string }> = {
  sunrise: { mid: "#f97316", end: "#fde047", midPos: "0.42" },
  ocean: { mid: "#06b6d4", end: "#2563eb", midPos: "0.48" },
  candy: { mid: "#ec4899", end: "#8b5cf6", midPos: "0.52" },
  complementary: { mid: "#16a34a", end: "#f97316", midPos: "0.50" }
};

const CURVE_PACKS: Record<Exclude<CurvePresetId, "custom">, { lPreset: Exclude<CurvePresetId, "custom">; midA: string; midB: string }> = {
  contrast: { lPreset: "contrast", midA: "0.58", midB: "0.58" },
  filmic: { lPreset: "filmic", midA: "0.46", midB: "0.44" },
  "pastel-recover": { lPreset: "pastel-recover", midA: "0.52", midB: "0.52" }
};

const recipeStorageKey = "okcolor-edit:recipes:v1";
const localeStorageKey = "okcolor-edit:locale:v1";
let recipes: SavedRecipe[] = [];

type LocaleId = "en" | "zh-CN";

type I18nKeys =
  | "title"
  | "subtitle"
  | "languageLabel"
  | "lShift"
  | "aShift"
  | "bShift"
  | "cShift"
  | "hShift"
  | "maskFeatherLabel"
  | "maskLRangeLabel"
  | "maskCRangeLabel"
  | "maskHintPrefix"
  | "maskScopeLabel"
  | "curvePackLabel"
  | "curvePackCustom"
  | "curvePresetLabel"
  | "curveCustom"
  | "curveContrast"
  | "curveFilmic"
  | "curvePastel"
  | "curveMidLabel"
  | "curveMidALabel"
  | "curveMidBLabel"
  | "gradientPaletteLabel"
  | "paletteCustom"
  | "paletteSunrise"
  | "paletteOcean"
  | "paletteCandy"
  | "paletteComplementary"
  | "startStopLabel"
  | "middlePosLabel"
  | "middleColorLabel"
  | "extraStop2Label"
  | "extraStop4Label"
  | "endStopLabel"
  | "recipesLabel"
  | "recipePlaceholder"
  | "load"
  | "delete"
  | "recipeNameLabel"
  | "recipeNamePlaceholder"
  | "saveCurrent"
  | "histogramLabel"
  | "waveformLabel"
  | "gamutPolicyLabel"
  | "gamutClip"
  | "gamutCompress"
  | "gamutWarn"
  | "undo"
  | "redo"
  | "applySolid"
  | "applyGradient"
  | "tip"
  | "inGamut"
  | "outOfGamut"
  | "curveHintPrefix";

const I18N: Record<LocaleId, Record<I18nKeys, string>> = {
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
    subtitle: "Oklab/Oklch 转换、渐变、曲线、色域策略",
    languageLabel: "语言",
    lShift: "L 明度偏移",
    aShift: "a 轴偏移",
    bShift: "b 轴偏移",
    cShift: "C 饱和度偏移",
    hShift: "H 色相偏移",
    maskFeatherLabel: "蒙版羽化",
    maskLRangeLabel: "L 范围 最小/最大",
    maskCRangeLabel: "C 范围 最小/最大",
    maskHintPrefix: "蒙版权重",
    maskScopeLabel: "渐变上的蒙版覆盖",
    curvePackLabel: "曲线组合包",
    curvePackCustom: "自定义",
    curvePresetLabel: "曲线预设（L 通道）",
    curveCustom: "自定义中点",
    curveContrast: "对比增强",
    curveFilmic: "电影感",
    curvePastel: "粉彩恢复",
    curveMidLabel: "曲线中点（L，仅自定义）",
    curveMidALabel: "曲线中点（a，自定义）",
    curveMidBLabel: "曲线中点（b，自定义）",
    gradientPaletteLabel: "渐变色板",
    paletteCustom: "自定义",
    paletteSunrise: "日出",
    paletteOcean: "海洋",
    paletteCandy: "糖果",
    paletteComplementary: "互补",
    startStopLabel: "起点颜色",
    middlePosLabel: "中间点位置",
    middleColorLabel: "中间点颜色",
    extraStop2Label: "额外节点 A",
    extraStop4Label: "额外节点 B",
    endStopLabel: "终点颜色",
    recipesLabel: "调整配方",
    recipePlaceholder: "（选择已保存配方）",
    load: "加载",
    delete: "删除",
    recipeNameLabel: "配方名称",
    recipeNamePlaceholder: "例如：柔和电影感青色",
    saveCurrent: "保存当前设置",
    histogramLabel: "Oklab 直方图（L/a/b）",
    waveformLabel: "Oklab 波形图（L/a/b）",
    gamutPolicyLabel: "色域策略",
    gamutClip: "裁剪",
    gamutCompress: "压缩",
    gamutWarn: "警告 + 裁剪",
    undo: "撤销",
    redo: "重做",
    applySolid: "应用纯色",
    applyGradient: "应用渐变",
    tip: "提示：先选择带有 SOLID 填充的图层。",
    inGamut: "色域内",
    outOfGamut: "超出色域，已按策略处理",
    curveHintPrefix: "曲线"
  }
};

let currentLocale: LocaleId = "en";

function captureState(): UiState {
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
    curvePack: curvePack.value as Exclude<CurvePresetId, "custom"> | "custom",
    curvePreset: curvePreset.value as CurvePresetId,
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
    gamutPolicy: gamutPolicy.value as GamutPolicy
  };
}

function statesEqual(left: UiState, right: UiState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveLocale(candidate: string | null): LocaleId {
  return candidate === "zh-CN" ? "zh-CN" : "en";
}

function t(key: I18nKeys): string {
  return I18N[currentLocale][key];
}

function applyLocale(localeId: LocaleId): void {
  currentLocale = localeId;
  localStorage.setItem(localeStorageKey, localeId);
  locale.value = localeId;

  const textNodes = document.querySelectorAll<HTMLElement>("[data-i18n]");
  for (const node of textNodes) {
    const key = node.dataset.i18n as I18nKeys | undefined;
    if (!key) continue;
    node.textContent = t(key);
  }

  const placeholderNodes = document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]");
  for (const node of placeholderNodes) {
    const key = node.dataset.i18nPlaceholder as I18nKeys | undefined;
    if (!key) continue;
    node.placeholder = t(key);
  }

  renderRecipeOptions(recipeList.value);
  refreshStatus();
}

function setControls(state: UiState): void {
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

function updateHistoryButtons(): void {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function normalizeRecipeState(state: Partial<UiState> | undefined): UiState {
  const fallback = captureState();
  return {
    ...fallback,
    ...state,
    curvePack: typeof state?.curvePack === "string" ? state.curvePack as Exclude<CurvePresetId, "custom"> | "custom" : fallback.curvePack,
    curveMidA: typeof state?.curveMidA === "string" ? state.curveMidA : fallback.curveMidA,
    curveMidB: typeof state?.curveMidB === "string" ? state.curveMidB : fallback.curveMidB
  };
}

function loadRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(recipeStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRecipe[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((recipe) => Boolean(recipe?.name) && Boolean(recipe?.state))
      .map((recipe) => ({
        ...recipe,
        state: normalizeRecipeState(recipe.state)
      }));
  } catch {
    return [];
  }
}

function persistRecipes(): void {
  localStorage.setItem(recipeStorageKey, JSON.stringify(recipes));
}

function renderRecipeOptions(selectedName = ""): void {
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

function saveCurrentRecipe(): void {
  const name = recipeName.value.trim();
  if (!name) {
    return;
  }

  const now = Date.now();
  const state = captureState();
  const existingIndex = recipes.findIndex((recipe) => recipe.name === name);
  const nextRecipe: SavedRecipe = { name, state, updatedAt: now };

  if (existingIndex >= 0) {
    recipes[existingIndex] = nextRecipe;
  } else {
    recipes.push(nextRecipe);
  }

  recipes.sort((left, right) => right.updatedAt - left.updatedAt);
  persistRecipes();
  renderRecipeOptions(name);
}

function loadSelectedRecipe(): void {
  const selectedName = recipeList.value;
  if (!selectedName) return;

  const selected = recipes.find((recipe) => recipe.name === selectedName);
  if (!selected) return;

  applyHistoryState(selected.state);
  recipeName.value = selected.name;
}

function deleteSelectedRecipe(): void {
  const selectedName = recipeList.value;
  if (!selectedName) return;

  recipes = recipes.filter((recipe) => recipe.name !== selectedName);
  persistRecipes();
  renderRecipeOptions();
  recipeName.value = "";
}

function rgbToHex(rgb: RGB): string {
  const r = Math.round(Math.min(1, Math.max(0, rgb.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, rgb.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, rgb.b)) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "").trim();
  const parsed = Number.parseInt(normalized, 16);
  const r = ((parsed >> 16) & 255) / 255;
  const g = ((parsed >> 8) & 255) / 255;
  const b = (parsed & 255) / 255;
  return { r, g, b };
}

function applyPalette(paletteId: string): void {
  const preset = PALETTES[paletteId];
  if (!preset) return;
  gradMidColor.value = preset.mid;
  gradEndColor.value = preset.end;
  gradMidPos.value = preset.midPos;
  gradStop2Enabled.checked = false;
  gradStop4Enabled.checked = false;
}

parent.postMessage({ pluginMessage: { type: "request-selection-color" } }, "*");

window.onmessage = (evt: MessageEvent) => {
  const msg = evt.data.pluginMessage;
  if (msg?.type === "selection-color" && msg.color) {
    selectedColor = msg.color as RGB;
    const editedBase = computeEditedColor().rgb;
    gradStartColor.value = rgbToHex(editedBase);
    if (gradPalette.value !== "custom") {
      applyPalette(gradPalette.value);
    }
    renderGradientPreview();
  }
};

function applyCurvePack(packId: Exclude<CurvePresetId, "custom"> | "custom"): void {
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

function getLumaCurve(): CurvePoint[] {
  const preset = curvePreset.value as CurvePresetId;
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

function getAxisCurve(mid: number): CurvePoint[] {
  return [
    { x: 0, y: 0 },
    { x: 0.5, y: mid },
    { x: 1, y: 1 }
  ];
}

function curveLabel(points: CurvePoint[]): string {
  return points.map((point) => `(${point.x.toFixed(2)},${point.y.toFixed(2)})`).join(" -> ");
}

function computeEditedColor(): { rgb: RGB; clipped: boolean; maskWeight: number } {
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
  const gamut = enforceGamut(rawRgb, gamutPolicy.value as GamutPolicy);
  return { ...gamut, maskWeight };
}

function getGradientStops(): Array<{ position: number; color: RGB }> {
  const stops: Array<{ position: number; color: RGB }> = [
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

function renderGradientPreview(): void {
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

function getRampOklabSamples(sampleCount = 64): ReturnType<typeof rgbToOklab>[] {
  return gradientRampFromStops(getGradientStops(), sampleCount).map((rgb) => rgbToOklab(rgb));
}

function renderLabHistogram(): void {
  const ctx = labHistogram.getContext("2d");
  if (!ctx) return;

  const width = labHistogram.width;
  const height = labHistogram.height;
  const bins = 24;
  const channels = {
    l: new Array<number>(bins).fill(0),
    a: new Array<number>(bins).fill(0),
    b: new Array<number>(bins).fill(0)
  };

  for (const sample of getRampOklabSamples()) {
    channels.l[Math.min(bins - 1, Math.max(0, Math.floor(sample.l * bins)))] += 1;
    channels.a[Math.min(bins - 1, Math.max(0, Math.floor(((sample.a + 0.4) / 0.8) * bins)))] += 1;
    channels.b[Math.min(bins - 1, Math.max(0, Math.floor(((sample.b + 0.4) / 0.8) * bins)))] += 1;
  }

  const maxBin = Math.max(1, ...channels.l, ...channels.a, ...channels.b);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const barWidth = width / bins;
  const drawChannel = (values: number[], color: string): void => {
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

function renderLabWaveform(): void {
  const ctx = labWaveform.getContext("2d");
  if (!ctx) return;

  const width = labWaveform.width;
  const height = labWaveform.height;
  const samples = getRampOklabSamples();
  const lastIndex = Math.max(1, samples.length - 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const drawLine = (mapY: (sample: ReturnType<typeof rgbToOklab>) => number, color: string): void => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < samples.length; i++) {
      const x = (i / lastIndex) * width;
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
  drawLine((sample) => height - ((sample.a + 0.4) / 0.8) * (height - 1), "#16a34a");
  drawLine((sample) => height - ((sample.b + 0.4) / 0.8) * (height - 1), "#dc2626");
}

function getMaskConfig(): { lMin: number; lMax: number; cMin: number; cMax: number; feather: number } {
  return {
    lMin: Math.min(Number(maskLMin.value), Number(maskLMax.value)),
    lMax: Math.max(Number(maskLMin.value), Number(maskLMax.value)),
    cMin: Math.min(Number(maskCMin.value), Number(maskCMax.value)),
    cMax: Math.max(Number(maskCMin.value), Number(maskCMax.value)),
    feather: Number(maskFeather.value)
  };
}

function renderMaskScope(weights: number[]): void {
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

function refreshExtraStopControls(): void {
  gradStop2Pos.disabled = !gradStop2Enabled.checked;
  gradStop2Color.disabled = !gradStop2Enabled.checked;
  gradStop4Pos.disabled = !gradStop4Enabled.checked;
  gradStop4Color.disabled = !gradStop4Enabled.checked;
}

function refreshStatus(): void {
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
  curveMid.disabled = (curvePreset.value as CurvePresetId) !== "custom";

  const maskConfig = getMaskConfig();
  const maskWeights = getRampOklabSamples().map((sample) =>
    computeRegionMaskWeight(oklabToOklch(sample), maskConfig)
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
}

function applyHistoryState(state: UiState): void {
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

function pushUndo(state: UiState): void {
  undoStack.push(state);
  if (undoStack.length > historyLimit) {
    undoStack.shift();
  }
}

function undo(): void {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(lastState);
  applyHistoryState(previous);
}

function redo(): void {
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
      applyCurvePack(curvePack.value as Exclude<CurvePresetId, "custom"> | "custom");
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
  const isRedo = ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "y") ||
    ((evt.ctrlKey || evt.metaKey) && evt.shiftKey && evt.key.toLowerCase() === "z");

  if (isUndo) {
    evt.preventDefault();
    undo();
  }
  if (isRedo) {
    evt.preventDefault();
    redo();
  }
});

applyBtn.onclick = () => {
  const edited = computeEditedColor();
  parent.postMessage({ pluginMessage: { type: "apply-solid-color", color: edited.rgb } }, "*");
};

applyGradientBtn.onclick = () => {
  parent.postMessage({ pluginMessage: { type: "apply-gradient", stops: getGradientStops() } }, "*");
};

const initialEdited = computeEditedColor().rgb;
gradStartColor.value = rgbToHex(initialEdited);
gradMidColor.value = "#14b8a6";
gradEndColor.value = "#6366f1";
recipes = loadRecipes();
const storedLocale = resolveLocale(localStorage.getItem(localeStorageKey));
applyLocale(storedLocale);
lastState = captureState();
updateHistoryButtons();
