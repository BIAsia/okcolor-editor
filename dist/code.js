(function () {
// ============================================================
// OKColor Editor – Figma plugin backend
// Handles selection scanning, fill updates, and image I/O
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
// ── Original-fill store for non-destructive preview ───────
const originalFills = new Map();
function storeOriginals(nodes) {
    for (const node of nodes) {
        if ("fills" in node && !originalFills.has(node.id)) {
            originalFills.set(node.id, node.fills);
        }
    }
}
function restoreOriginals(nodes) {
    for (const node of nodes) {
        const orig = originalFills.get(node.id);
        if (orig && "fills" in node) {
            node.fills = orig;
        }
    }
}
// ── Selection scanning ────────────────────────────────────
function collectFillableNodes(nodes) {
    const result = [];
    for (const node of nodes) {
        if ("fills" in node) {
            result.push(node);
        }
        // Recurse into groups and frames
        if ("children" in node) {
            result.push(...collectFillableNodes(node.children));
        }
    }
    return result;
}
function getSelectionInfo() {
    const allNodes = collectFillableNodes(figma.currentPage.selection);
    const fills = [];
    let hasImages = false;
    for (const node of allNodes) {
        const nodeFills = node.fills;
        if (!Array.isArray(nodeFills))
            continue;
        nodeFills.forEach((fill, idx) => {
            var _a, _b;
            if (fill.type === "SOLID") {
                fills.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    fillIndex: idx,
                    fillType: "SOLID",
                    color: Object.assign({}, fill.color),
                    opacity: (_a = fill.opacity) !== null && _a !== void 0 ? _a : 1,
                });
            }
            else if (fill.type === "GRADIENT_LINEAR" ||
                fill.type === "GRADIENT_RADIAL" ||
                fill.type === "GRADIENT_ANGULAR" ||
                fill.type === "GRADIENT_DIAMOND") {
                fills.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    fillIndex: idx,
                    fillType: "GRADIENT",
                    gradientStops: fill.gradientStops.map((stop) => {
                        var _a;
                        return ({
                            color: Object.assign({}, stop.color),
                            opacity: (_a = stop.color.a) !== null && _a !== void 0 ? _a : 1,
                            position: stop.position,
                        });
                    }),
                });
            }
            else if (fill.type === "IMAGE") {
                fills.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    fillIndex: idx,
                    fillType: "IMAGE",
                    imageHash: (_b = fill.imageHash) !== null && _b !== void 0 ? _b : undefined,
                });
                hasImages = true;
            }
        });
    }
    return { count: allNodes.length, fills, hasImages };
}
function applyColorChanges(changes) {
    var _a;
    // Group changes by nodeId
    const byNode = new Map();
    for (const change of changes) {
        if (!byNode.has(change.nodeId))
            byNode.set(change.nodeId, []);
        byNode.get(change.nodeId).push(change);
    }
    for (const [nodeId, nodeChanges] of byNode) {
        const node = figma.getNodeById(nodeId);
        if (!node || !("fills" in node))
            continue;
        const fills = [...node.fills];
        for (const change of nodeChanges) {
            const fill = fills[change.fillIndex];
            if (!fill)
                continue;
            if (change.fillType === "SOLID" && fill.type === "SOLID" && change.color) {
                fills[change.fillIndex] = Object.assign(Object.assign({}, fill), { color: change.color, opacity: (_a = change.opacity) !== null && _a !== void 0 ? _a : fill.opacity });
            }
            else if (change.fillType === "GRADIENT" &&
                (fill.type === "GRADIENT_LINEAR" ||
                    fill.type === "GRADIENT_RADIAL" ||
                    fill.type === "GRADIENT_ANGULAR" ||
                    fill.type === "GRADIENT_DIAMOND") &&
                change.gradientStops) {
                const gradFill = fill;
                const newStops = change.gradientStops.map((s, i) => (Object.assign(Object.assign({}, gradFill.gradientStops[i]), { color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.opacity } })));
                fills[change.fillIndex] = Object.assign(Object.assign({}, gradFill), { gradientStops: newStops });
            }
        }
        node.fills = fills;
    }
}
function applyImageChanges(changes) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const change of changes) {
            if (change.fillType !== "IMAGE" || !change.imageBytes)
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
    storeOriginals(figma.currentPage.selection);
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
});

})();
