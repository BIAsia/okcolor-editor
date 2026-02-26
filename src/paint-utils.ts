export type PaintLike = { type: string };

export type ApplyPaintStats = {
  updatedNodes: number;
  skippedNoFills: number;
  skippedReadonly: number;
};

export function isGradientPaintType(type: string): boolean {
  return type === "GRADIENT_LINEAR" ||
    type === "GRADIENT_RADIAL" ||
    type === "GRADIENT_ANGULAR" ||
    type === "GRADIENT_DIAMOND";
}

export function findGradientOrSolidReplaceIndex(fills: ReadonlyArray<PaintLike>): number {
  const gradientIndex = fills.findIndex((paint) => isGradientPaintType(paint.type));
  if (gradientIndex >= 0) return gradientIndex;
  return fills.findIndex((paint) => paint.type === "SOLID");
}

export function replaceAtOrPrepend<T>(items: ReadonlyArray<T>, index: number, nextItem: T): T[] {
  if (index >= 0 && index < items.length) {
    return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
  }
  return [nextItem].concat(items);
}

export function formatApplyPaintNotification(actionLabel: string, stats: ApplyPaintStats): {
  message: string;
  error: boolean;
} {
  const { updatedNodes, skippedNoFills, skippedReadonly } = stats;
  const skippedTotal = skippedNoFills + skippedReadonly;

  if (updatedNodes > 0) {
    const base = `Applied ${actionLabel} to ${updatedNodes} layer${updatedNodes > 1 ? "s" : ""}`;
    if (skippedTotal === 0) {
      return { message: base, error: false };
    }

    const details: string[] = [];
    if (skippedNoFills > 0) details.push(`${skippedNoFills} without fills`);
    if (skippedReadonly > 0) details.push(`${skippedReadonly} readonly`);
    return { message: `${base} (skipped ${skippedTotal}: ${details.join(", ")})`, error: false };
  }

  if (skippedNoFills > 0 || skippedReadonly > 0) {
    const details: string[] = [];
    if (skippedNoFills > 0) details.push(`${skippedNoFills} without fills`);
    if (skippedReadonly > 0) details.push(`${skippedReadonly} readonly`);
    return { message: `No editable selection (${details.join(", ")})`, error: true };
  }

  return { message: "No selected layers with editable fills", error: true };
}
