// src/color.ts
var clamp01 = (v) => Math.min(1, Math.max(0, v));
var deg2rad = (d) => d * Math.PI / 180;
var rad2deg = (r) => r * 180 / Math.PI;
function srgbToLinear(v) {
  const c2 = clamp01(v);
  return c2 <= 0.04045 ? c2 / 12.92 : Math.pow((c2 + 0.055) / 1.055, 2.4);
}
function linearToSrgb(v) {
  const c2 = clamp01(v);
  return c2 <= 31308e-7 ? 12.92 * c2 : 1.055 * Math.pow(c2, 1 / 2.4) - 0.055;
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
function oklabToRgb(lab) {
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
    r: clamp01(linearToSrgb(rLin)),
    g: clamp01(linearToSrgb(gLin)),
    b: clamp01(linearToSrgb(bLin))
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
function mixOklch(a2, b2, t) {
  const x = Math.min(1, Math.max(0, t));
  const dh = ((b2.h - a2.h) % 360 + 540) % 360 - 180;
  return {
    l: a2.l + (b2.l - a2.l) * x,
    c: a2.c + (b2.c - a2.c) * x,
    h: (a2.h + dh * x + 360) % 360
  };
}
function adjustInOklab(rgb, delta) {
  const lab = rgbToOklab(rgb);
  return oklabToRgb({
    l: lab.l + (delta.l ?? 0),
    a: lab.a + (delta.a ?? 0),
    b: lab.b + (delta.b ?? 0)
  });
}
function adjustInOklch(rgb, delta) {
  const lch = oklabToOklch(rgbToOklab(rgb));
  return oklabToRgb(
    oklchToOklab({
      l: lch.l + (delta.l ?? 0),
      c: Math.max(0, lch.c + (delta.c ?? 0)),
      h: (lch.h + (delta.h ?? 0) + 360) % 360
    })
  );
}
function applyCurve(value, points) {
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
function applyLabCurves(rgb, curves) {
  const lab = rgbToOklab(rgb);
  const normA = (lab.a + 0.4) / 0.8;
  const normB = (lab.b + 0.4) / 0.8;
  const nextL = curves.l ? applyCurve(lab.l, curves.l) : lab.l;
  const nextA = curves.a ? applyCurve(normA, curves.a) * 0.8 - 0.4 : lab.a;
  const nextB = curves.b ? applyCurve(normB, curves.b) * 0.8 - 0.4 : lab.b;
  return oklabToRgb({ l: nextL, a: nextA, b: nextB });
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
function gradientRamp(start, end, steps) {
  const a2 = oklabToOklch(rgbToOklab(start));
  const b2 = oklabToOklch(rgbToOklab(end));
  const count = Math.max(2, Math.floor(steps));
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    out.push(oklabToRgb(oklchToOklab(mixOklch(a2, b2, t))));
  }
  return out;
}
function gradientRampMulti(stops, stepsPerSegment) {
  const validStops = stops.filter(Boolean);
  if (validStops.length < 2) return validStops;
  const segSteps = Math.max(2, Math.floor(stepsPerSegment));
  const out = [];
  for (let i = 0; i < validStops.length - 1; i++) {
    const seg = gradientRamp(validStops[i], validStops[i + 1], segSteps);
    for (let j = 0; j < seg.length; j++) {
      if (i > 0 && j === 0) continue;
      out.push(seg[j]);
    }
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
var curveMid = byId("curveMid");
var curveHint = byId("curveHint");
var gradStops = byId("gradStops");
var gradHue = byId("gradHue");
var gradHint = byId("gradHint");
var gradPreview = byId("gradPreview");
var gamutPolicy = byId("gamutPolicy");
var gamutStatus = byId("gamutStatus");
var applyBtn = byId("apply");
var selectedColor = { r: 0.5, g: 0.5, b: 0.5 };
parent.postMessage({ pluginMessage: { type: "request-selection-color" } }, "*");
window.onmessage = (evt) => {
  const msg = evt.data.pluginMessage;
  if (msg?.type === "selection-color" && msg.color) {
    selectedColor = msg.color;
    renderGradientPreview();
  }
};
function computeEditedColor() {
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
  return enforceGamut(safe, gamutPolicy.value);
}
function renderGradientPreview() {
  const ctx = gradPreview.getContext("2d");
  if (!ctx) return;
  const stopCount = Math.max(2, Math.floor(Number(gradStops.value)));
  const huePerStop = Number(gradHue.value);
  const start = computeEditedColor().rgb;
  const stops = [];
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
function refreshStatus() {
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
