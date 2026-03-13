// ============================================================
// OKColor Editor – Figma plugin backend
// Handles selection scanning, fill/stroke updates, and image I/O
// ============================================================

figma.showUI(__html__, { width: 320, height: 600, title: "OKColor Editor" });

// ── Types ─────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

interface FillInfo {
  nodeId: string;
  nodeName: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
  source: "fill" | "stroke";
  /** For SOLID fills */
  color?: RGB;
  opacity?: number;
  /** For GRADIENT fills – array of stop colors */
  gradientStops?: Array<{ color: RGB; opacity: number; position: number }>;
  /** For IMAGE fills */
  imageHash?: string;
}

interface SelectionInfo {
  count: number;
  fills: FillInfo[];
  hasImages: boolean;
}

interface ColorChange {
  nodeId: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
  source: "fill" | "stroke";
  /** For SOLID */
  color?: RGB;
  opacity?: number;
  /** For GRADIENT */
  gradientStops?: Array<{ color: RGB; opacity: number; position: number }>;
  /** For IMAGE */
  imageBytes?: Uint8Array;
}

// ── Original paint store for non-destructive editing ──────

const originalFills = new Map<string, ReadonlyArray<Paint>>();
const originalStrokes = new Map<string, ReadonlyArray<Paint>>();

/** Node IDs from the previous selection – committed on selection change. */
let previousSelectionIds: string[] = [];

function storeOriginals(nodes: readonly SceneNode[]): void {
  for (const node of nodes) {
    if ("fills" in node && !originalFills.has(node.id)) {
      originalFills.set(node.id, (node as GeometryMixin).fills as ReadonlyArray<Paint>);
    }
    if ("strokes" in node && !originalStrokes.has(node.id)) {
      originalStrokes.set(node.id, (node as MinimalStrokesMixin).strokes as ReadonlyArray<Paint>);
    }
  }
}

/** Make preview writes permanent by discarding stored originals. */
function commitNodes(nodeIds: string[]): void {
  for (const id of nodeIds) {
    originalFills.delete(id);
    originalStrokes.delete(id);
  }
}

function restoreOriginals(nodes: readonly SceneNode[]): void {
  for (const node of nodes) {
    const origFills = originalFills.get(node.id);
    if (origFills && "fills" in node) {
      (node as GeometryMixin).fills = origFills;
    }
    const origStrokes = originalStrokes.get(node.id);
    if (origStrokes && "strokes" in node) {
      (node as MinimalStrokesMixin).strokes = origStrokes;
    }
  }
}

// ── Selection scanning ────────────────────────────────────

function collectFillableNodes(nodes: readonly SceneNode[]): SceneNode[] {
  const seen = new Set<string>();
  const result: SceneNode[] = [];

  function walk(list: readonly SceneNode[]): void {
    for (const node of list) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);

      if ("fills" in node || "strokes" in node) {
        result.push(node);
      }
      // Recurse into groups, frames, components, etc.
      if ("children" in node) {
        walk((node as ChildrenMixin).children);
      }
    }
  }

  walk(nodes);
  return result;
}

/**
 * Scan an array of paints (fills or strokes) and push FillInfo entries.
 * Returns true if any IMAGE paints were found.
 */
function scanPaints(
  paints: ReadonlyArray<Paint>,
  node: SceneNode,
  source: "fill" | "stroke",
  out: FillInfo[],
): boolean {
  let hasImages = false;

  for (let idx = 0; idx < paints.length; idx++) {
    const paint = paints[idx];

    if (paint.type === "SOLID") {
      out.push({
        nodeId: node.id,
        nodeName: node.name,
        fillIndex: idx,
        fillType: "SOLID",
        source,
        color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
        opacity: paint.opacity ?? 1,
      });
    } else if (
      paint.type === "GRADIENT_LINEAR" ||
      paint.type === "GRADIENT_RADIAL" ||
      paint.type === "GRADIENT_ANGULAR" ||
      paint.type === "GRADIENT_DIAMOND"
    ) {
      out.push({
        nodeId: node.id,
        nodeName: node.name,
        fillIndex: idx,
        fillType: "GRADIENT",
        source,
        gradientStops: paint.gradientStops.map((stop) => ({
          color: { r: stop.color.r, g: stop.color.g, b: stop.color.b },
          opacity: stop.color.a ?? 1,
          position: stop.position,
        })),
      });
    } else if (paint.type === "IMAGE") {
      out.push({
        nodeId: node.id,
        nodeName: node.name,
        fillIndex: idx,
        fillType: "IMAGE",
        source,
        imageHash: (paint as ImagePaint).imageHash ?? undefined,
      });
      hasImages = true;
    }
  }

  return hasImages;
}

function getSelectionInfo(): SelectionInfo {
  const allNodes = collectFillableNodes(figma.currentPage.selection);
  const fills: FillInfo[] = [];
  let hasImages = false;

  for (const node of allNodes) {
    // Scan fills – prefer stored originals to avoid feedback loop
    if ("fills" in node) {
      const stored = originalFills.get(node.id);
      const paints = (stored ?? (node as GeometryMixin).fills) as ReadonlyArray<Paint>;
      if (Array.isArray(paints)) {
        if (scanPaints(paints, node, "fill", fills)) hasImages = true;
      }
    }

    // Scan strokes
    if ("strokes" in node) {
      const stored = originalStrokes.get(node.id);
      const paints = (stored ?? (node as MinimalStrokesMixin).strokes) as ReadonlyArray<Paint>;
      if (Array.isArray(paints)) {
        if (scanPaints(paints, node, "stroke", fills)) hasImages = true;
      }
    }
  }

  return { count: allNodes.length, fills, hasImages };
}

// ── Applying paint changes ────────────────────────────────

function applyPaintChanges(paints: Paint[], changes: ColorChange[]): void {
  for (const change of changes) {
    const paint = paints[change.fillIndex];
    if (!paint) continue;

    if (change.fillType === "SOLID" && paint.type === "SOLID" && change.color) {
      paints[change.fillIndex] = {
        ...paint,
        color: change.color,
        opacity: change.opacity ?? paint.opacity,
      } as SolidPaint;
    } else if (
      change.fillType === "GRADIENT" &&
      (paint.type === "GRADIENT_LINEAR" ||
        paint.type === "GRADIENT_RADIAL" ||
        paint.type === "GRADIENT_ANGULAR" ||
        paint.type === "GRADIENT_DIAMOND") &&
      change.gradientStops
    ) {
      const gradPaint = paint as GradientPaint;
      const newStops: ColorStop[] = change.gradientStops.map((s, i) => ({
        ...gradPaint.gradientStops[i],
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.opacity },
      }));
      paints[change.fillIndex] = { ...gradPaint, gradientStops: newStops };
    }
  }
}

function applyColorChanges(changes: ColorChange[]): void {
  // Group changes by nodeId
  const byNode = new Map<string, ColorChange[]>();
  for (const change of changes) {
    if (!byNode.has(change.nodeId)) byNode.set(change.nodeId, []);
    byNode.get(change.nodeId)!.push(change);
  }

  for (const [nodeId, nodeChanges] of byNode) {
    const node = figma.getNodeById(nodeId) as SceneNode | null;
    if (!node) continue;

    // Apply fill changes
    const fillChanges = nodeChanges.filter((c) => c.source !== "stroke");
    if (fillChanges.length > 0 && "fills" in node) {
      const fills = [...((node as GeometryMixin).fills as ReadonlyArray<Paint>)] as Paint[];
      applyPaintChanges(fills, fillChanges);
      (node as GeometryMixin).fills = fills;
    }

    // Apply stroke changes
    const strokeChanges = nodeChanges.filter((c) => c.source === "stroke");
    if (strokeChanges.length > 0 && "strokes" in node) {
      const strokes = [...((node as MinimalStrokesMixin).strokes as ReadonlyArray<Paint>)] as Paint[];
      applyPaintChanges(strokes, strokeChanges);
      (node as MinimalStrokesMixin).strokes = strokes;
    }
  }
}

async function applyImageChanges(changes: ColorChange[]): Promise<void> {
  for (const change of changes) {
    if (change.fillType !== "IMAGE" || !change.imageBytes) continue;
    // Image changes only apply to fills (not strokes)
    if (change.source === "stroke") continue;

    const node = figma.getNodeById(change.nodeId) as SceneNode | null;
    if (!node || !("fills" in node)) continue;

    const fills = [
      ...((node as GeometryMixin).fills as ReadonlyArray<Paint>),
    ] as Paint[];
    const fill = fills[change.fillIndex];
    if (!fill || fill.type !== "IMAGE") continue;

    const newImage = await figma.createImage(change.imageBytes);
    fills[change.fillIndex] = {
      ...(fill as ImagePaint),
      imageHash: newImage.hash,
    };
    (node as GeometryMixin).fills = fills;
  }
}

// ── Image byte I/O ────────────────────────────────────────

async function sendImageBytes(nodeId: string, fillIndex: number, imageHash: string): Promise<void> {
  const image = figma.getImageByHash(imageHash);
  if (!image) return;
  try {
    const bytes = await image.getBytesAsync();
    figma.ui.postMessage({
      type: "image-bytes",
      nodeId,
      fillIndex,
      bytes,
    });
  } catch (e) {
    console.error("Failed to get image bytes:", e);
  }
}

// ── Selection change listener ─────────────────────────────

function notifySelectionChange(): void {
  // Commit previous selection (make preview writes permanent)
  commitNodes(previousSelectionIds);

  // Track new selection
  const currentNodes = collectFillableNodes(figma.currentPage.selection);
  previousSelectionIds = currentNodes.map((n) => n.id);

  storeOriginals(currentNodes);
  const info = getSelectionInfo();
  figma.ui.postMessage({ type: "selection-update", data: info });
}

figma.on("selectionchange", notifySelectionChange);

// ── Message handler ───────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "init": {
      notifySelectionChange();
      break;
    }

    case "request-image": {
      const { nodeId, fillIndex, imageHash } = msg;
      await sendImageBytes(nodeId, fillIndex, imageHash);
      break;
    }

    case "apply-changes": {
      const changes = msg.changes as ColorChange[];
      const solidAndGrad = changes.filter((c) => c.fillType !== "IMAGE");
      const imageCh = changes.filter((c) => c.fillType === "IMAGE");

      applyColorChanges(solidAndGrad);
      if (imageCh.length > 0) {
        await applyImageChanges(imageCh);
      }
      break;
    }

    case "revert": {
      const allNodes = collectFillableNodes(figma.currentPage.selection);
      restoreOriginals(allNodes);

      // Re-store originals so further edits work from the reverted state
      for (const node of allNodes) {
        originalFills.delete(node.id);
        originalStrokes.delete(node.id);
      }
      storeOriginals(allNodes);

      const info = getSelectionInfo();
      figma.ui.postMessage({ type: "selection-update", data: info });
      break;
    }

    case "close": {
      figma.closePlugin();
      break;
    }
  }
};
