// ============================================================
// OKColor Editor – Figma plugin backend
// Handles selection scanning, fill updates, and image I/O
// ============================================================

figma.showUI(__html__, { width: 320, height: 600, title: "OKColor Editor" });

// ── Types ─────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

interface FillInfo {
  nodeId: string;
  nodeName: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
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

// ── Original-fill store for non-destructive preview ───────

const originalFills = new Map<string, ReadonlyArray<Paint>>();

function storeOriginals(nodes: readonly SceneNode[]): void {
  for (const node of nodes) {
    if ("fills" in node && !originalFills.has(node.id)) {
      originalFills.set(node.id, (node as GeometryMixin).fills as ReadonlyArray<Paint>);
    }
  }
}

function restoreOriginals(nodes: readonly SceneNode[]): void {
  for (const node of nodes) {
    const orig = originalFills.get(node.id);
    if (orig && "fills" in node) {
      (node as GeometryMixin).fills = orig;
    }
  }
}

// ── Selection scanning ────────────────────────────────────

function collectFillableNodes(nodes: readonly SceneNode[]): SceneNode[] {
  const result: SceneNode[] = [];
  for (const node of nodes) {
    if ("fills" in node) {
      result.push(node);
    }
    // Recurse into groups and frames
    if ("children" in node) {
      result.push(...collectFillableNodes((node as ChildrenMixin).children));
    }
  }
  return result;
}

function getSelectionInfo(): SelectionInfo {
  const allNodes = collectFillableNodes(figma.currentPage.selection);
  const fills: FillInfo[] = [];
  let hasImages = false;

  for (const node of allNodes) {
    const nodeFills = (node as GeometryMixin).fills as ReadonlyArray<Paint>;
    if (!Array.isArray(nodeFills)) continue;

    nodeFills.forEach((fill, idx) => {
      if (fill.type === "SOLID") {
        fills.push({
          nodeId: node.id,
          nodeName: node.name,
          fillIndex: idx,
          fillType: "SOLID",
          color: { ...fill.color },
          opacity: fill.opacity ?? 1,
        });
      } else if (
        fill.type === "GRADIENT_LINEAR" ||
        fill.type === "GRADIENT_RADIAL" ||
        fill.type === "GRADIENT_ANGULAR" ||
        fill.type === "GRADIENT_DIAMOND"
      ) {
        fills.push({
          nodeId: node.id,
          nodeName: node.name,
          fillIndex: idx,
          fillType: "GRADIENT",
          gradientStops: fill.gradientStops.map((stop) => ({
            color: { ...stop.color },
            opacity: stop.color.a ?? 1,
            position: stop.position,
          })),
        });
      } else if (fill.type === "IMAGE") {
        fills.push({
          nodeId: node.id,
          nodeName: node.name,
          fillIndex: idx,
          fillType: "IMAGE",
          imageHash: fill.imageHash ?? undefined,
        });
        hasImages = true;
      }
    });
  }

  return { count: allNodes.length, fills, hasImages };
}

// ── Applying color changes ────────────────────────────────

interface ColorChange {
  nodeId: string;
  fillIndex: number;
  fillType: "SOLID" | "GRADIENT" | "IMAGE";
  /** For SOLID */
  color?: RGB;
  opacity?: number;
  /** For GRADIENT */
  gradientStops?: Array<{ color: RGB; opacity: number; position: number }>;
  /** For IMAGE */
  imageBytes?: Uint8Array;
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
    if (!node || !("fills" in node)) continue;

    const fills = [...((node as GeometryMixin).fills as ReadonlyArray<Paint>)] as Paint[];

    for (const change of nodeChanges) {
      const fill = fills[change.fillIndex];
      if (!fill) continue;

      if (change.fillType === "SOLID" && fill.type === "SOLID" && change.color) {
        fills[change.fillIndex] = {
          ...fill,
          color: change.color,
          opacity: change.opacity ?? fill.opacity,
        } as SolidPaint;
      } else if (
        change.fillType === "GRADIENT" &&
        (fill.type === "GRADIENT_LINEAR" ||
          fill.type === "GRADIENT_RADIAL" ||
          fill.type === "GRADIENT_ANGULAR" ||
          fill.type === "GRADIENT_DIAMOND") &&
        change.gradientStops
      ) {
        const gradFill = fill as GradientPaint;
        const newStops: ColorStop[] = change.gradientStops.map((s, i) => ({
          ...gradFill.gradientStops[i],
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.opacity },
        }));
        fills[change.fillIndex] = { ...gradFill, gradientStops: newStops };
      }
    }

    (node as GeometryMixin).fills = fills;
  }
}

async function applyImageChanges(changes: ColorChange[]): Promise<void> {
  for (const change of changes) {
    if (change.fillType !== "IMAGE" || !change.imageBytes) continue;

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
  storeOriginals(figma.currentPage.selection);
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

      if (msg.permanent) {
        // Clear stored originals so reset is no longer possible
        for (const node of figma.currentPage.selection) {
          originalFills.delete(node.id);
        }
        storeOriginals(figma.currentPage.selection); // store new state
        figma.notify("OKColor: changes applied");
      }
      break;
    }

    case "revert": {
      restoreOriginals(figma.currentPage.selection);
      figma.notify("OKColor: reverted");
      notifySelectionChange();
      break;
    }

    case "close": {
      figma.closePlugin();
      break;
    }
  }
};
