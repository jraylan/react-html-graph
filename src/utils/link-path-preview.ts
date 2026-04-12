import { GraphLinkAnchor } from "../types";
import {
    buildLengthTable,
    cubicBezier,
    cubicCurveToPath,
    getBoundsFromPoints,
    normalAt,
    normalizeLabelPosition,
    parameterAtLength,
    pointsToSplinePath,
    resolveFixedTangentCurveFromAnchors,
    sampleOffsetPoints,
} from "./link-curve";

type LivePathInput = {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
    steps: number;
};

type LiveBidirectionalPathInput = LivePathInput & {
    gap: number;
};

type LiveLabelInput = {
    position: number;
    offset: number;
};

type LiveBidirectionalLabelInput = {
    position: number;
    side: string;
    offset: number;
};

/**
 * Calcula um preview síncrono e leve do path unidirecional para uso durante o drag.
 */
export function calculateLivePathPreview({ from, to, steps }: LivePathInput) {
    const curve = resolveFixedTangentCurveFromAnchors(from, to);
    const points = sampleOffsetPoints(curve, 0, steps);

    return {
        pathD: cubicCurveToPath(curve),
        bounds: getBoundsFromPoints(points),
    };
}

/**
 * Calcula um preview síncrono e leve do path bidirecional para uso durante o drag.
 */
export function calculateLiveBidirectionalPathPreview({ from, to, gap, steps }: LiveBidirectionalPathInput) {
    const curve = resolveFixedTangentCurveFromAnchors(from, to);
    const samples = sampleOffsetPoints(curve, 0, steps);
    const halfGap = gap / 2;
    const forwardPoints = samples.map(point => ({
        x: point.x - point.nx * halfGap,
        y: point.y - point.ny * halfGap,
    }));
    const reversePoints = samples.map(point => ({
        x: point.x + point.nx * halfGap,
        y: point.y + point.ny * halfGap,
    }));
    const bounds = getBoundsFromPoints([...forwardPoints, ...reversePoints]);
    const padding = 50 + gap;

    return {
        centerD: cubicCurveToPath(curve),
        forwardD: pointsToSplinePath(forwardPoints),
        reverseD: pointsToSplinePath(reversePoints),
        bounds: {
            left: bounds.left - padding,
            top: bounds.top - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2,
        },
    };
}

/**
 * Calcula uma posição leve de labels ao longo da curva para uso durante o drag.
 */
export function calculateLiveLabelsPreview(input: {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
    labels: LiveLabelInput[];
}) {
    const curve = resolveFixedTangentCurveFromAnchors(input.from, input.to);
    const table = buildLengthTable(curve, 120);
    const totalLength = table[table.length - 1];

    return input.labels.map(label => {
        const t = parameterAtLength(table, normalizeLabelPosition(label.position) * totalLength);
        const point = cubicBezier(curve, t);
        return {
            x: point.x,
            y: point.y,
            textAnchor: "middle",
        };
    });
}

/**
 * Calcula uma posição leve de labels bidirecionais ao longo da curva para uso durante o drag.
 */
export function calculateLiveBidirectionalLabelsPreview(input: {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
    halfGap: number;
    labels: LiveBidirectionalLabelInput[];
}) {
    const curve = resolveFixedTangentCurveFromAnchors(input.from, input.to);
    const table = buildLengthTable(curve, 120);
    const totalLength = table[table.length - 1];

    return input.labels.map(label => {
        const t = parameterAtLength(table, normalizeLabelPosition(label.position) * totalLength);
        const point = cubicBezier(curve, t);
        const normal = normalAt(curve, t);

        if (label.side === "forward" || label.side === "reverse") {
            const sign = label.side === "forward" ? -1 : 1;
            const displacement = (input.halfGap + (label.offset ?? 0)) * sign;
            const outNormalX = normal.x * sign;
            return {
                x: point.x + normal.x * displacement,
                y: point.y + normal.y * displacement,
                textAnchor: outNormalX < 0 ? "end" : "start",
            };
        }

        return {
            x: point.x,
            y: point.y,
            textAnchor: "middle",
        };
    });
}
