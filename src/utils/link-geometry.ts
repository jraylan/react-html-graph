import { GraphLinkAnchor, GraphLinkEndpointState, GraphNodeRuntimeState, GraphPortLocation, Vector2 } from "../types";

export const ZERO_VECTOR: Vector2 = { x: 0, y: 0 };

const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

/** Converte aliases laterais em um vetor (não-normalizado). */
export function portVector(location: GraphPortLocation): Vector2 {
    if (typeof location === "string") {
        switch (location) {
            case "left": return { x: -1, y: 0 };
            case "right": return { x: 1, y: 0 };
            case "top": return { x: 0, y: -1 };
            case "bottom": return { x: 0, y: 1 };
            default: return ZERO_VECTOR;
        }
    }
    return { x: location.x, y: location.y };
}

/** Converte aliases laterais ou vetores arbitrários em um vetor normalizado. */
export function normalizePortVector(location: GraphPortLocation): Vector2 {
    const raw = portVector(location);
    const magnitude = Math.hypot(raw.x, raw.y);
    if (magnitude === 0) return ZERO_VECTOR;
    return { x: raw.x / magnitude, y: raw.y / magnitude };
}

/** Resolve a âncora global de uma porta a partir do estado runtime do nó. */
export function buildLinkAnchor(
    nodeState: GraphNodeRuntimeState | null,
    location?: GraphPortLocation | null,
): GraphLinkAnchor | null {
    if (!nodeState || !location) return null;

    // Posição: cada componente do vetor cru (clampeado em [-1, 1])
    // escala a meia-dimensão, então uma porta ``{x:1, y:0.6}`` cai
    // na borda direita e distribuída no eixo Y — sem a normalização
    // puxá-la para dentro. A direção ``d`` (tangente da curva)
    // permanece normalizada.
    const raw = portVector(location);
    const px = clamp(raw.x, -1, 1);
    const py = clamp(raw.y, -1, 1);
    const d = normalizePortVector(location);
    const centerX = nodeState.position.x + nodeState.width / 2;
    const centerY = nodeState.position.y + nodeState.height / 2;

    return {
        x: centerX + px * (nodeState.width / 2),
        y: centerY + py * (nodeState.height / 2),
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