import {
  adjustInOklab,
  adjustInOklch,
  applyLabCurves,
  gradientRamp,
  oklabToRgb,
  rgbToOklab,
  enforceGamut,
  type RGB,
  type GamutPolicy
} from "../src/color";

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const l = byId<HTMLInputElement>("l");
const a = byId<HTMLInputElement>("a");
const b = byId<HTMLInputElement>("b");
const c = byId<HTMLInputElement>("c");
const h = byId<HTMLInputElement>("h");
const curveMid = byId<HTMLInputElement>("curveMid");
const curveHint = byId<HTMLDivElement>("curveHint");
const gradHue = byId<HTMLInputElement>("gradHue");
const gradPreview = byId<HTMLCanvasElement>("gradPreview");
const gamutPolicy = byId<HTMLSelectElement>("gamutPolicy");
const gamutStatus = byId<HTMLDivElement>("gamutStatus");
const applyBtn = byId<HTMLButtonElement>("apply");
const undoBtn = byId<HTMLButtonElement>("undo");
const redoBtn = byId<HTMLButtonElement>("redo");

let selectedColor: RGB = { r: 0.5, g: 0.5, b: 0.5 };

type UiState = {
  l: string;
  a: string;
  b: string;
  c: string;
  h: string;
  curveMid: string;
  gradHue: string;
  gamutPolicy: GamutPolicy;
};

const historyLimit = 60;
const undoStack: UiState[] = [];
const redoStack: UiState[] = [];
let applyingHistory = false;
let lastState: UiState;

function captureState(): UiState {
  return {
    l: l.value,
    a: a.value,
    b: b.value,
    c: c.value,
    h: h.value,
    curveMid: curveMid.value,
    gradHue: gradHue.value,
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
  curveMid.value = state.curveMid;
  gradHue.value = state.gradHue;
  gamutPolicy.value = state.gamutPolicy;
}

function updateHistoryButtons(): void {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

parent.postMessage({ pluginMessage: { type: "request-selection-color" } }, "*");

window.onmessage = (evt: MessageEvent) => {
  const msg = evt.data.pluginMessage;
  if (msg?.type === "selection-color" && msg.color) {
    selectedColor = msg.color as RGB;
    renderGradientPreview();
  }
};

function computeEditedColor(): { rgb: RGB; clipped: boolean } {
  const deltaLab = { l: Number(l.value), a: Number(a.value), b: Number(b.value) };
  const afterLab = adjustInOklab(selectedColor, deltaLab);
  const afterLch = adjustInOklch(afterLab, { c: Number(c.value), h: Number(h.value) });

  const curve = Number(curveMid.value);
  const afterCurve = applyLabCurves(afterLch, {
    l: [
      { x: 0, y: 0 },
      { x: 0.5, y: curve },
      { x: 1, y: 1 }
    ]
  });

  const safe = oklabToRgb(rgbToOklab(afterCurve));
  return enforceGamut(safe, gamutPolicy.value as GamutPolicy);
}

function renderGradientPreview(): void {
  const ctx = gradPreview.getContext("2d");
  if (!ctx) return;

  const start = computeEditedColor().rgb;
  const end = adjustInOklch(start, { h: Number(gradHue.value) });
  const ramp = gradientRamp(start, end, 24);
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

  curveHint.textContent = `curve: (0,0) -> (0.5,${Number(curveMid.value).toFixed(2)}) -> (1,1)`;
  renderGradientPreview();
}

function applyHistoryState(state: UiState): void {
  applyingHistory = true;
  setControls(state);
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

[l, a, b, c, h, curveMid, gradHue, gamutPolicy].forEach((node) => {
  node.addEventListener("input", () => {
    if (applyingHistory) return;
    const before = lastState;
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

refreshStatus();
lastState = captureState();
updateHistoryButtons();
