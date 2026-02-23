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
let recipes: SavedRecipe[] = [];

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
  placeholder.textContent = "(select saved recipe)";
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
    gamutStatus.textContent = `Out-of-gamut handled by policy: ${policy}`;
    gamutStatus.className = "small warn";
  } else {
    gamutStatus.textContent = "In gamut";
    gamutStatus.className = "small";
  }

  const curvePoints = getLumaCurve();
  curveHint.textContent = `curve: ${curveLabel(curvePoints)}`;
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
renderRecipeOptions();
refreshStatus();
lastState = captureState();
updateHistoryButtons();
