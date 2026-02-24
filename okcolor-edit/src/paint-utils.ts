export type PaintLike = { type: string };

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
  return [nextItem, ...items];
}
