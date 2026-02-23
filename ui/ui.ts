import {
  adjustInOklab,
  adjustInOklch,
  applyLabCurves,
  gradientRampMulti,
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
const gradStops = byId<HTMLInputElement>("gradStops");
const gradHue = byId<HTMLInputElement>("gradHue");
const gradHint = byId<HTMLDivElement>("gradHint");
const gradPreview = byId<HTMLCanvasElement>("gradPreview");
const gamutPolicy = byId<HTMLSelectElement>("gamutPolicy");
const gamutStatus = byId<HTMLDivElement>("gamutStatus");
const applyBtn = byId<HTMLButtonElement>("apply");

let selectedColor: RGB = { r: 0.5, g: 0.5, b: 0.5 };

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

  const stopCount = Math.max(2, Math.floor(Number(gradStops.value)));
  const huePerStop = Number(gradHue.value);
  const start = computeEditedColor().rgb;

  const stops: RGB[] = [];
  for (let i = 0; i < stopCount; i++) {
    stops.push(adjustInOklch(start, { h: huePerStop * i }));
  }

  const ramp = gradientRampMulti(stops, 12);
  const step = gradPreview.width / Math.max(1, ramp.length);

  ctx.clearRect(0, 0, gradPreview.width, gradPreview.height);
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
  gradHint.textContent = `${Math.floor(Number(gradStops.value))} stops, ${Number(gradHue.value) >= 0 ? "+" : ""}${Math.floor(Number(gradHue.value))} deg hue/stop`;
  renderGradientPreview();
}

[l, a, b, c, h, curveMid, gradStops, gradHue, gamutPolicy].forEach((node) => {
  node.addEventListener("input", refreshStatus);
  node.addEventListener("change", refreshStatus);
});

applyBtn.onclick = () => {
  const edited = computeEditedColor();
  parent.postMessage({ pluginMessage: { type: "apply-solid-color", color: edited.rgb } }, "*");
};

refreshStatus();
