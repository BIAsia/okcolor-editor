import { describe, expect, it } from "vitest";
import {
  findGradientOrSolidReplaceIndex,
  formatApplyPaintNotification,
  isGradientPaintType,
  replaceAtOrPrepend
} from "../src/paint-utils";

describe("paint utils", () => {
  it("detects all supported gradient paint types", () => {
    expect(isGradientPaintType("GRADIENT_LINEAR")).toBe(true);
    expect(isGradientPaintType("GRADIENT_RADIAL")).toBe(true);
    expect(isGradientPaintType("GRADIENT_ANGULAR")).toBe(true);
    expect(isGradientPaintType("GRADIENT_DIAMOND")).toBe(true);
    expect(isGradientPaintType("SOLID")).toBe(false);
  });

  it("prefers replacing an existing gradient over a leading solid", () => {
    const fills = [
      { type: "SOLID", id: "solid" },
      { type: "GRADIENT_RADIAL", id: "gradient" }
    ];

    expect(findGradientOrSolidReplaceIndex(fills)).toBe(1);
  });

  it("falls back to solid replacement when no gradient exists", () => {
    const fills = [{ type: "IMAGE" }, { type: "SOLID" }];
    expect(findGradientOrSolidReplaceIndex(fills)).toBe(1);
  });

  it("prepends when no replacement index is available", () => {
    const next = replaceAtOrPrepend([{ type: "IMAGE" }], -1, { type: "SOLID" });
    expect(next[0].type).toBe("SOLID");
    expect(next[1].type).toBe("IMAGE");
  });

  it("formats partial success notification with explicit fallback counts", () => {
    expect(formatApplyPaintNotification("gradient", {
      updatedNodes: 2,
      skippedNoFills: 1,
      skippedReadonly: 1
    })).toEqual({
      message: "Applied gradient to 2 layers (skipped 2: 1 without fills, 1 readonly)",
      error: false
    });
  });

  it("formats failure notification when nothing is editable", () => {
    expect(formatApplyPaintNotification("OKColor edit", {
      updatedNodes: 0,
      skippedNoFills: 2,
      skippedReadonly: 1
    })).toEqual({
      message: "No editable selection (2 without fills, 1 readonly)",
      error: true
    });
  });
});
