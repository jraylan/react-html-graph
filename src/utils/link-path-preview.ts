import { GraphLinkAnchor } from "../types";

type Vector2Like = { x: number; y: number };
type SampledPoint = { x: number; y: number; nx: number; ny: number };
type Bounds = { left: number; top: number; width: number; height: number };

type QuadraticCurve = {
    p0x: number;
    p0y: number;
    p1x: number;
    p1y: number;
    p2x: number;
    p2y: number;
};

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

function normalizeVector(x: number, y: number): Vector2Like {
    const magnitude = Math.hypot(x, y);
    if (magnitude === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: x / magnitude,
        y: y / magnitude,
    };
}

function controlPoint(x: number, y: number, vector: Vector2Like, dist: number): Vector2Like {
    return {
        x: x + vector.x * dist,
        y: y + vector.y * dist,
    };
}

function inferPathVectors(from: GraphLinkAnchor, to: GraphLinkAnchor) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const forward = normalizeVector(dx, dy);

    if (forward.x !== 0 || forward.y !== 0) {
        return {
            fromVector: forward,
            toVector: { x: -forward.x, y: -forward.y },
        };
    }

    return {
        fromVector: { x: 1, y: 0 },
        toVector: { x: -1, y: 0 },
    };
}

function resolvePathVectors(from: GraphLinkAnchor, to: GraphLinkAnchor) {
    const inferred = inferPathVectors(from, to);
    const fromVector = from.d && (from.d.x !== 0 || from.d.y !== 0)
        ? normalizeVector(from.d.x, from.d.y)
        : inferred.fromVector;
    const toVector = to.d && (to.d.x !== 0 || to.d.y !== 0)
        ? normalizeVector(to.d.x, to.d.y)
        : inferred.toVector;

    return { fromVector, toVector };
}

function resolveQuadraticCurve(from: GraphLinkAnchor, to: GraphLinkAnchor): QuadraticCurve {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const controlDistance = Math.max(50, distance * 0.4);
    const vectors = resolvePathVectors(from, to);
    const cubicCp1 = controlPoint(from.x, from.y, vectors.fromVector, controlDistance);
    const cubicCp2 = controlPoint(to.x, to.y, vectors.toVector, controlDistance);

    return {
        p0x: from.x,
        p0y: from.y,
        p1x: (-from.x + cubicCp1.x * 3 + cubicCp2.x * 3 - to.x) / 4,
        p1y: (-from.y + cubicCp1.y * 3 + cubicCp2.y * 3 - to.y) / 4,
        p2x: to.x,
        p2y: to.y,
    };
}

function quadraticBezier(curve: QuadraticCurve, t: number) {
    const t1 = 1 - t;
    return {
        x: t1 * t1 * curve.p0x + 2 * t1 * t * curve.p1x + t * t * curve.p2x,
        y: t1 * t1 * curve.p0y + 2 * t1 * t * curve.p1y + t * t * curve.p2y,
    };
}

function quadraticBezierTangent(curve: QuadraticCurve, t: number) {
    const t1 = 1 - t;
    return {
        x: 2 * t1 * (curve.p1x - curve.p0x) + 2 * t * (curve.p2x - curve.p1x),
        y: 2 * t1 * (curve.p1y - curve.p0y) + 2 * t * (curve.p2y - curve.p1y),
    };
}

function normalAt(curve: QuadraticCurve, t: number): Vector2Like {
    const tangent = quadraticBezierTangent(curve, t);
    const magnitude = Math.hypot(tangent.x, tangent.y) || 1;
    return {
        x: -tangent.y / magnitude,
        y: tangent.x / magnitude,
    };
}

function sampleOffsetPoints(curve: QuadraticCurve, offset: number, steps: number) {
    const safeSteps = Math.max(1, Math.floor(steps));
    const points: SampledPoint[] = [];

    for (let index = 0; index <= safeSteps; index++) {
        const t = index / safeSteps;
        const point = quadraticBezier(curve, t);
        const normal = normalAt(curve, t);
        points.push({
            x: point.x + normal.x * offset,
            y: point.y + normal.y * offset,
            nx: normal.x,
            ny: normal.y,
        });
    }

    return points;
}

function pointsToQuadraticPath(points: Array<{ x: number; y: number }>) {
    if (points.length < 2) return "";

    let d = `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
        const controlX = (points[0].x + points[1].x) / 2;
        const controlY = (points[0].y + points[1].y) / 2;
        return `${d} Q ${controlX} ${controlY} ${points[1].x} ${points[1].y}`;
    }

    for (let index = 1; index < points.length - 1; index++) {
        const control = points[index];
        const next = points[index + 1];
        const midpointX = (control.x + next.x) / 2;
        const midpointY = (control.y + next.y) / 2;
        d += ` Q ${control.x} ${control.y} ${midpointX} ${midpointY}`;
    }

    const lastControl = points[points.length - 2];
    const lastPoint = points[points.length - 1];
    d += ` Q ${lastControl.x} ${lastControl.y} ${lastPoint.x} ${lastPoint.y}`;

    return d;
}

function getBoundsFromPoints(points: Array<{ x: number; y: number }>): Bounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    return {
        left: minX,
        top: minY,
        width: Math.max(0, maxX - minX),
        height: Math.max(0, maxY - minY),
    };
}

function normalizeLabelPosition(position: number) {
    return Math.max(0, Math.min(1, (position + 1) / 2));
}

/**
 * Calcula um preview síncrono e leve do path unidirecional para uso durante o drag.
 */
export function calculateLivePathPreview({ from, to, steps }: LivePathInput) {
    const curve = resolveQuadraticCurve(from, to);
    const points = sampleOffsetPoints(curve, 0, steps);

    return {
        pathD: `M ${curve.p0x} ${curve.p0y} Q ${curve.p1x} ${curve.p1y} ${curve.p2x} ${curve.p2y}`,
        bounds: getBoundsFromPoints(points),
    };
}

/**
 * Calcula um preview síncrono e leve do path bidirecional para uso durante o drag.
 */
export function calculateLiveBidirectionalPathPreview({ from, to, gap, steps }: LiveBidirectionalPathInput) {
    const curve = resolveQuadraticCurve(from, to);
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
        centerD: `M ${curve.p0x} ${curve.p0y} Q ${curve.p1x} ${curve.p1y} ${curve.p2x} ${curve.p2y}`,
        forwardD: pointsToQuadraticPath(forwardPoints),
        reverseD: pointsToQuadraticPath(reversePoints),
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
    const curve = resolveQuadraticCurve(input.from, input.to);

    return input.labels.map(label => {
        const t = normalizeLabelPosition(label.position);
        const point = quadraticBezier(curve, t);
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
    const curve = resolveQuadraticCurve(input.from, input.to);

    return input.labels.map(label => {
        const t = normalizeLabelPosition(label.position);
        const point = quadraticBezier(curve, t);
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
