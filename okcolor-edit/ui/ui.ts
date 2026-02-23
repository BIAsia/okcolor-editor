import {
  applyCurve,
  enforceGamut,
  getCurvePreset,
  gradientRampFromStops,
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
const locale = byId<HTMLSelectElement>("locale");
const curvePreset = byId<HTMLSelectElement>("curvePreset");
const curveMid = byId<HTMLInputElement>("curveMid");
const curveHint = byId<HTMLDivElement>("curveHint");
const gradPalette = byId<HTMLSelectElement>("gradPalette");
const gradStartColor = byId<HTMLInputElement>("gradStartColor");
const gradMidPos = byId<HTMLInputElement>("gradMidPos");
const gradMidColor = byId<HTMLInputElement>("gradMidColor");
const gradEndColor = byId<HTMLInputElement>("gradEndColor");
const gradPreview = byId<HTMLCanvasElement>("gradPreview");
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
  curvePreset: CurvePresetId;
  curveMid: string;
  gradPalette: string;
  gradStartColor: string;
  gradMidPos: string;
  gradMidColor: string;
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
  | "curvePresetLabel"
  | "curveCustom"
  | "curveContrast"
  | "curveFilmic"
  | "curvePastel"
  | "curveMidLabel"
  | "gradientPaletteLabel"
  | "paletteCustom"
  | "paletteSunrise"
  | "paletteOcean"
  | "paletteCandy"
  | "paletteComplementary"
  | "startStopLabel"
  | "middlePosLabel"
  | "middleColorLabel"
  | "endStopLabel"
  | "recipesLabel"
  | "recipePlaceholder"
  | "load"
  | "delete"
  | "recipeNameLabel"
  | "recipeNamePlaceholder"
  | "saveCurrent"
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
    curvePresetLabel: "Curve preset (L channel)",
    curveCustom: "custom midpoint",
    curveContrast: "contrast",
    curveFilmic: "filmic",
    curvePastel: "pastel recover",
    curveMidLabel: "Curve midpoint (custom only)",
    gradientPaletteLabel: "Gradient palette",
    paletteCustom: "custom",
    paletteSunrise: "sunrise",
    paletteOcean: "ocean",
    paletteCandy: "candy",
    paletteComplementary: "complementary",
    startStopLabel: "Start stop color",
    middlePosLabel: "Middle stop position",
    middleColorLabel: "Middle stop color",
    endStopLabel: "End stop color",
    recipesLabel: "Adjustment recipes",
    recipePlaceholder: "(select saved recipe)",
    load: "Load",
    delete: "Delete",
    recipeNameLabel: "Recipe name",
    recipeNamePlaceholder: "e.g. soft filmic teal",
    saveCurrent: "Save current settings",
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
    curvePresetLabel: "曲线预设（L 通道）",
    curveCustom: "自定义中点",
    curveContrast: "对比增强",
    curveFilmic: "电影感",
    curvePastel: "粉彩恢复",
    curveMidLabel: "曲线中点（仅自定义）",
    gradientPaletteLabel: "渐变色板",
    paletteCustom: "自定义",
    paletteSunrise: "日出",
    paletteOcean: "海洋",
    paletteCandy: "糖果",
    paletteComplementary: "互补",
    startStopLabel: "起点颜色",
    middlePosLabel: "中间点位置",
    middleColorLabel: "中间点颜色",
    endStopLabel: "终点颜色",
    recipesLabel: "调整配方",
    recipePlaceholder: "（选择已保存配方）",
    load: "加载",
    delete: "删除",
    recipeNameLabel: "配方名称",
    recipeNamePlaceholder: "例如：柔和电影感青色",
    saveCurrent: "保存当前设置",
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
    curvePreset: curvePreset.value as CurvePresetId,
    curveMid: curveMid.value,
    gradPalette: gradPalette.value,
    gradStartColor: gradStartColor.value,
    gradMidPos: gradMidPos.value,
    gradMidColor: gradMidColor.value,
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
  curvePreset.value = state.curvePreset;
  curveMid.value = state.curveMid;
  gradPalette.value = state.gradPalette;
  gradStartColor.value = state.gradStartColor;
  gradMidPos.value = state.gradMidPos;
  gradMidColor.value = state.gradMidColor;
  gradEndColor.value = state.gradEndColor;
  gamutPolicy.value = state.gamutPolicy;
}

function updateHistoryButtons(): void {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function loadRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(recipeStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRecipe[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((recipe) => Boolean(recipe?.name) && Boolean(recipe?.state));
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

function curveLabel(points: CurvePoint[]): string {
  return points.map((point) => `(${point.x.toFixed(2)},${point.y.toFixed(2)})`).join(" -> ");
}

function computeEditedColor(): { rgb: RGB; clipped: boolean } {
  const deltaLab = { l: Number(l.value), a: Number(a.value), b: Number(b.value) };
  const baseLab = rgbToOklab(selectedColor);
  const shiftedLab = {
    l: baseLab.l + deltaLab.l,
    a: baseLab.a + deltaLab.a,
    b: baseLab.b + deltaLab.b
  };

  const shiftedLch = oklabToOklch(shiftedLab);
  const adjustedLch = {
    l: shiftedLch.l,
    c: Math.max(0, shiftedLch.c + Number(c.value)),
    h: (shiftedLch.h + Number(h.value) + 360) % 360
  };

  const labAfterLch = oklchToOklab(adjustedLch);
  const curve = getLumaCurve();
  const labAfterCurve = {
    l: applyCurve(labAfterLch.l, curve),
    a: labAfterLch.a,
    b: labAfterLch.b
  };

  const rawRgb = oklabToRgbUnclamped(labAfterCurve);
  return enforceGamut(rawRgb, gamutPolicy.value as GamutPolicy);
}

function getGradientStops(): Array<{ position: number; color: RGB }> {
  return [
    { position: 0, color: hexToRgb(gradStartColor.value) },
    { position: Number(gradMidPos.value), color: hexToRgb(gradMidColor.value) },
    { position: 1, color: hexToRgb(gradEndColor.value) }
  ];
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

  const curvePoints = getLumaCurve();
  curveHint.textContent = `${t("curveHintPrefix")}: ${curveLabel(curvePoints)}`;
  curveMid.disabled = (curvePreset.value as CurvePresetId) !== "custom";

  if (gradPalette.value === "custom") {
    gradStartColor.value = rgbToHex(edited.rgb);
  }
  renderGradientPreview();
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

[l, a, b, c, h, curvePreset, curveMid, gradPalette, gradStartColor, gradMidPos, gradMidColor, gradEndColor, gamutPolicy].forEach((node) => {
  node.addEventListener("input", () => {
    if (applyingHistory) return;
    const before = lastState;
    if (node === gradPalette && gradPalette.value !== "custom") {
      applyPalette(gradPalette.value);
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
