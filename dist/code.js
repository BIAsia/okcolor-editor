"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/code.ts
  figma.showUI(__html__, { width: 360, height: 520 });
  function getSolidPaintColor() {
    const node = figma.currentPage.selection[0];
    if (!node || !("fills" in node)) return null;
    const fills = node.fills;
    const solid = fills.find((p) => p.type === "SOLID");
    return solid ? solid.color : null;
  }
  figma.ui.onmessage = (msg) => {
    if (msg.type === "request-selection-color") {
      figma.ui.postMessage({ type: "selection-color", color: getSolidPaintColor() });
    }
    if (msg.type === "apply-solid-color") {
      const node = figma.currentPage.selection[0];
      if (!node || !("fills" in node)) return;
      const fills = node.fills;
      const next = fills.map(
        (p) => p.type === "SOLID" ? __spreadProps(__spreadValues({}, p), { color: msg.color }) : p
      );
      node.fills = next;
      figma.notify("Applied OKColor edit");
    }
    if (msg.type === "close") {
      figma.closePlugin();
    }
  };
})();
