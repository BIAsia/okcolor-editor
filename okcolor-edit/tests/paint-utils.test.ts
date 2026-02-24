import { describe, expect, it } from "vitest";
import { findGradientOrSolidReplaceIndex, isGradientPaintType, replaceAtOrPrepend } from "../src/paint-utils";

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
});
