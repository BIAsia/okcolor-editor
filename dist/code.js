(function () {
// ============================================================
// OKColor Editor – Figma plugin backend
// Handles selection scanning, fill/stroke updates, and image I/O
// ============================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 320, height: 600, title: "OKColor Editor" });
// ── Original paint store for non-destructive editing ──────
const originalFills = new Map();
const originalStrokes = new Map();
/** Node IDs from the previous selection – committed on selection change. */
let previousSelectionIds = [];
function storeOriginals(nodes) {
    for (const node of nodes) {
        if ("fills" in node && !originalFills.has(node.id)) {
            originalFills.set(node.id, node.fills);
        }
        if ("strokes" in node && !originalStrokes.has(node.id)) {
            originalStrokes.set(node.id, node.strokes);
        }
    }
}
/** Make preview writes permanent by discarding stored originals. */
function commitNodes(nodeIds) {
    for (const id of nodeIds) {
        originalFills.delete(id);
        originalStrokes.delete(id);
    }
}
function restoreOriginals(nodes) {
    for (const node of nodes) {
        const origFills = originalFills.get(node.id);
        if (origFills && "fills" in node) {
            node.fills = origFills;
        }
        const origStrokes = originalStrokes.get(node.id);
        if (origStrokes && "strokes" in node) {
            node.strokes = origStrokes;
        }
    }
}
// ── Selection scanning ────────────────────────────────────
function collectFillableNodes(nodes) {
    const seen = new Set();
    const result = [];
    function walk(list) {
        for (const node of list) {
            if (seen.has(node.id))
                continue;
            seen.add(node.id);
            if ("fills" in node || "strokes" in node) {
                result.push(node);
            }
            // Recurse into groups, frames, components, etc.
            if ("children" in node) {
                walk(node.children);
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
function scanPaints(paints, node, source, out) {
    var _a, _b;
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
                opacity: (_a = paint.opacity) !== null && _a !== void 0 ? _a : 1,
            });
        }
        else if (paint.type === "GRADIENT_LINEAR" ||
            paint.type === "GRADIENT_RADIAL" ||
            paint.type === "GRADIENT_ANGULAR" ||
            paint.type === "GRADIENT_DIAMOND") {
            out.push({
                nodeId: node.id,
                nodeName: node.name,
                fillIndex: idx,
                fillType: "GRADIENT",
                source,
                gradientStops: paint.gradientStops.map((stop) => {
                    var _a;
                    return ({
                        color: { r: stop.color.r, g: stop.color.g, b: stop.color.b },
                        opacity: (_a = stop.color.a) !== null && _a !== void 0 ? _a : 1,
                        position: stop.position,
                    });
                }),
            });
        }
        else if (paint.type === "IMAGE") {
            out.push({
                nodeId: node.id,
                nodeName: node.name,
                fillIndex: idx,
                fillType: "IMAGE",
                source,
                imageHash: (_b = paint.imageHash) !== null && _b !== void 0 ? _b : undefined,
            });
            hasImages = true;
        }
    }
    return hasImages;
}
function getSelectionInfo() {
    const allNodes = collectFillableNodes(figma.currentPage.selection);
    const fills = [];
    let hasImages = false;
    for (const node of allNodes) {
        // Scan fills – prefer stored originals to avoid feedback loop
        if ("fills" in node) {
            const stored = originalFills.get(node.id);
            const paints = (stored !== null && stored !== void 0 ? stored : node.fills);
            if (Array.isArray(paints)) {
                if (scanPaints(paints, node, "fill", fills))
                    hasImages = true;
            }
        }
        // Scan strokes
        if ("strokes" in node) {
            const stored = originalStrokes.get(node.id);
            const paints = (stored !== null && stored !== void 0 ? stored : node.strokes);
            if (Array.isArray(paints)) {
                if (scanPaints(paints, node, "stroke", fills))
                    hasImages = true;
            }
        }
    }
    return { count: allNodes.length, fills, hasImages };
}
// ── Applying paint changes ────────────────────────────────
function applyPaintChanges(paints, changes) {
    var _a;
    for (const change of changes) {
        const paint = paints[change.fillIndex];
        if (!paint)
            continue;
        if (change.fillType === "SOLID" && paint.type === "SOLID" && change.color) {
            paints[change.fillIndex] = Object.assign(Object.assign({}, paint), { color: change.color, opacity: (_a = change.opacity) !== null && _a !== void 0 ? _a : paint.opacity });
        }
        else if (change.fillType === "GRADIENT" &&
            (paint.type === "GRADIENT_LINEAR" ||
                paint.type === "GRADIENT_RADIAL" ||
                paint.type === "GRADIENT_ANGULAR" ||
                paint.type === "GRADIENT_DIAMOND") &&
            change.gradientStops) {
            const gradPaint = paint;
            const newStops = change.gradientStops.map((s, i) => (Object.assign(Object.assign({}, gradPaint.gradientStops[i]), { color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.opacity } })));
            paints[change.fillIndex] = Object.assign(Object.assign({}, gradPaint), { gradientStops: newStops });
        }
    }
}
function applyColorChanges(changes) {
    // Group changes by nodeId
    const byNode = new Map();
    for (const change of changes) {
        if (!byNode.has(change.nodeId))
            byNode.set(change.nodeId, []);
        byNode.get(change.nodeId).push(change);
    }
    for (const [nodeId, nodeChanges] of byNode) {
        const node = figma.getNodeById(nodeId);
        if (!node)
            continue;
        // Apply fill changes
        const fillChanges = nodeChanges.filter((c) => c.source !== "stroke");
        if (fillChanges.length > 0 && "fills" in node) {
            const fills = [...node.fills];
            applyPaintChanges(fills, fillChanges);
            node.fills = fills;
        }
        // Apply stroke changes
        const strokeChanges = nodeChanges.filter((c) => c.source === "stroke");
        if (strokeChanges.length > 0 && "strokes" in node) {
            const strokes = [...node.strokes];
            applyPaintChanges(strokes, strokeChanges);
            node.strokes = strokes;
        }
    }
}
function applyImageChanges(changes) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const change of changes) {
            if (change.fillType !== "IMAGE" || !change.imageBytes)
                continue;
            // Image changes only apply to fills (not strokes)
            if (change.source === "stroke")
                continue;
            const node = figma.getNodeById(change.nodeId);
            if (!node || !("fills" in node))
                continue;
            const fills = [
                ...node.fills,
            ];
            const fill = fills[change.fillIndex];
            if (!fill || fill.type !== "IMAGE")
                continue;
            const newImage = yield figma.createImage(change.imageBytes);
            fills[change.fillIndex] = Object.assign(Object.assign({}, fill), { imageHash: newImage.hash });
            node.fills = fills;
        }
    });
}
// ── Image byte I/O ────────────────────────────────────────
function sendImageBytes(nodeId, fillIndex, imageHash) {
    return __awaiter(this, void 0, void 0, function* () {
        const image = figma.getImageByHash(imageHash);
        if (!image)
            return;
        try {
            const bytes = yield image.getBytesAsync();
            figma.ui.postMessage({
                type: "image-bytes",
                nodeId,
                fillIndex,
                bytes,
            });
        }
        catch (e) {
            console.error("Failed to get image bytes:", e);
        }
    });
}
// ── Selection change listener ─────────────────────────────
function notifySelectionChange() {
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
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    switch (msg.type) {
        case "init": {
            notifySelectionChange();
            break;
        }
        case "request-image": {
            const { nodeId, fillIndex, imageHash } = msg;
            yield sendImageBytes(nodeId, fillIndex, imageHash);
            break;
        }
        case "apply-changes": {
            const changes = msg.changes;
            const solidAndGrad = changes.filter((c) => c.fillType !== "IMAGE");
            const imageCh = changes.filter((c) => c.fillType === "IMAGE");
            applyColorChanges(solidAndGrad);
            if (imageCh.length > 0) {
                yield applyImageChanges(imageCh);
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
});

})();
