import { GraphLinkAnchor, GraphLinkEndpointState, GraphNodeRuntimeState, GraphPortLocation, Vector2 } from "../types";

export const ZERO_VECTOR: Vector2 = { x: 0, y: 0 };

/** Converte aliases laterais ou vetores arbitrários em um vetor normalizado. */
export function normalizePortVector(location: GraphPortLocation): Vector2 {
    if (typeof location === "string") {
        switch (location) {
            case "left": return { x: -1, y: 0 };
            case "right": return { x: 1, y: 0 };
            case "top": return { x: 0, y: -1 };
            case "bottom": return { x: 0, y: 1 };
            default: return ZERO_VECTOR;
        }
    }

    const magnitude = Math.hypot(location.x, location.y);
    if (magnitude === 0) return ZERO_VECTOR;

    return {
        x: location.x / magnitude,
        y: location.y / magnitude,
    };
}

/** Resolve a âncora global de uma porta a partir do estado runtime do nó. */
export function buildLinkAnchor(
    nodeState: GraphNodeRuntimeState | null,
    location?: GraphPortLocation | null,
): GraphLinkAnchor | null {
    if (!nodeState || !location) return null;

    const d = normalizePortVector(location);
    const centerX = nodeState.position.x + nodeState.width / 2;
    const centerY = nodeState.position.y + nodeState.height / 2;

    return {
        x: centerX + d.x * (nodeState.width / 2),
        y: centerY + d.y * (nodeState.height / 2),
        z: nodeState.position.z,
        d,
    };
}

/** Constrói uma âncora virtual baseada apenas na posição do cursor. */
export function buildCursorAnchor(cursorPosition?: { x: number; y: number } | null): GraphLinkAnchor | null {
    if (!cursorPosition) return null;

    return {
        x: cursorPosition.x,
        y: cursorPosition.y,
        z: 0,
        d: ZERO_VECTOR,
    };
}

/** Converte um vetor da porta para a direção discreta usada pelo runtime do link. */
export function vectorToRuntimeDirection(vector: Vector2): GraphLinkEndpointState["direction"] {
    if (Math.abs(vector.x) >= Math.abs(vector.y)) {
        return vector.x >= 0 ? "right" : "left";
    }

    return vector.y >= 0 ? "bottom" : "top";
}