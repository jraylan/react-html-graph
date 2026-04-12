import type { PortDirection } from "../calculations/types";
import type { GraphLinkAnchor } from "../types";

export type Vector2Like = { x: number; y: number };
export type CurvePoint = { x: number; y: number };
export type SampledPoint = CurvePoint & { nx: number; ny: number };
export type Bounds = { left: number; top: number; width: number; height: number };

export type LinkCubicCurve = {
    p0x: number;
    p0y: number;
    p1x: number;
    p1y: number;
    p2x: number;
    p2y: number;
    p3x: number;
    p3y: number;
};

export type LinkCurveInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromVector?: Vector2Like;
    toVector?: Vector2Like;
    fromDir?: PortDirection;
    toDir?: PortDirection;
};

type PointSplineOptions = {
    startDirection?: Vector2Like;
    endDirection?: Vector2Like;
};

const DEFAULT_TENSION = 0.5;
const DEFAULT_TANGENT_RATIO = 0.6;
const DEFAULT_ANGLE_THRESHOLD = Math.PI / 4;
const DEFAULT_ANGLE_BOOST = 80;
const BEZIER_HANDLE_SCALE = 1 / (6 * DEFAULT_TENSION * DEFAULT_TENSION);
const INTERNAL_HANDLE_RATIO = DEFAULT_TANGENT_RATIO * BEZIER_HANDLE_SCALE;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

/** Normaliza um vetor 2D. */
export function normalizeVector(x: number, y: number): Vector2Like {
    const magnitude = Math.hypot(x, y);
    if (magnitude === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: x / magnitude,
        y: y / magnitude,
    };
}

function dot(left: Vector2Like, right: Vector2Like) {
    return left.x * right.x + left.y * right.y;
}

function angleBetween(left: Vector2Like, right: Vector2Like) {
    const leftMagnitude = Math.hypot(left.x, left.y);
    const rightMagnitude = Math.hypot(right.x, right.y);
    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return 0;
    }

    return Math.acos(clamp(dot(left, right) / (leftMagnitude * rightMagnitude), -1, 1));
}

function controlPoint(x: number, y: number, vector: Vector2Like, dist: number): Vector2Like {
    return {
        x: x + vector.x * dist,
        y: y + vector.y * dist,
    };
}

/** Converte uma direção textual de porta em vetor unitário. */
export function directionToVector(dir?: PortDirection): Vector2Like {
    switch (dir) {
        case "right":
            return { x: 1, y: 0 };
        case "left":
            return { x: -1, y: 0 };
        case "bottom":
            return { x: 0, y: 1 };
        case "top":
            return { x: 0, y: -1 };
        default:
            return { x: 0, y: 0 };
    }
}

function inferPathVectors(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = toX - fromX;
    const dy = toY - fromY;
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

/** Resolve os vetores efetivos usados no início e no fim do link. */
export function resolvePathVectors(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fromVector?: Vector2Like,
    toVector?: Vector2Like,
    fromDir?: PortDirection,
    toDir?: PortDirection,
) {
    const inferred = inferPathVectors(fromX, fromY, toX, toY);
    const resolvedFromVector = fromVector && (fromVector.x !== 0 || fromVector.y !== 0)
        ? normalizeVector(fromVector.x, fromVector.y)
        : fromDir
            ? directionToVector(fromDir)
            : inferred.fromVector;
    const resolvedToVector = toVector && (toVector.x !== 0 || toVector.y !== 0)
        ? normalizeVector(toVector.x, toVector.y)
        : toDir
            ? directionToVector(toDir)
            : inferred.toVector;

    return {
        fromVector: resolvedFromVector,
        toVector: resolvedToVector,
    };
}

function resolveEndpointHandleDistance(direction: Vector2Like, nearestPointVector: Vector2Like) {
    const nearestDistance = Math.hypot(nearestPointVector.x, nearestPointVector.y);
    if (nearestDistance === 0) {
        return 0;
    }

    let tangentLength = DEFAULT_TANGENT_RATIO * nearestDistance;
    const theta = angleBetween(direction, nearestPointVector);

    if (theta > DEFAULT_ANGLE_THRESHOLD) {
        tangentLength += DEFAULT_ANGLE_BOOST * (theta - DEFAULT_ANGLE_THRESHOLD);
    }

    return tangentLength * BEZIER_HANDLE_SCALE;
}

function resolveInternalAxis(previous: CurvePoint, current: CurvePoint, next: CurvePoint) {
    const incoming = normalizeVector(current.x - previous.x, current.y - previous.y);
    const outgoing = normalizeVector(next.x - current.x, next.y - current.y);
    const bisector = normalizeVector(incoming.x + outgoing.x, incoming.y + outgoing.y);

    if (bisector.x !== 0 || bisector.y !== 0) {
        return bisector;
    }

    if (outgoing.x !== 0 || outgoing.y !== 0) {
        return outgoing;
    }

    if (incoming.x !== 0 || incoming.y !== 0) {
        return incoming;
    }

    return normalizeVector(next.x - previous.x, next.y - previous.y);
}

function resolveAnchorDirection(candidate: Vector2Like | undefined, fallback: Vector2Like) {
    if (candidate && (candidate.x !== 0 || candidate.y !== 0)) {
        return normalizeVector(candidate.x, candidate.y);
    }

    return normalizeVector(fallback.x, fallback.y);
}

/**
 * Resolve uma curva cúbica com tangentes fixas nas extremidades.
 *
 * A fórmula segue a ideia do artigo do JointJS: a direção nas portas é fixa
 * e o comprimento do handle cresce quando o ângulo com o ponto vizinho fica
 * mais agressivo.
 */
export function resolveFixedTangentCurve(input: LinkCurveInput): LinkCubicCurve {
    const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir } = input;
    const vectors = resolvePathVectors(fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir);
    const startNeighbor = { x: toX - fromX, y: toY - fromY };
    const endNeighbor = { x: fromX - toX, y: fromY - toY };
    const startHandleDistance = resolveEndpointHandleDistance(vectors.fromVector, startNeighbor);
    const endHandleDistance = resolveEndpointHandleDistance(vectors.toVector, endNeighbor);
    const startControl = controlPoint(fromX, fromY, vectors.fromVector, startHandleDistance);
    const endControl = controlPoint(toX, toY, vectors.toVector, endHandleDistance);

    return {
        p0x: fromX,
        p0y: fromY,
        p1x: startControl.x,
        p1y: startControl.y,
        p2x: endControl.x,
        p2y: endControl.y,
        p3x: toX,
        p3y: toY,
    };
}

/** Gera a string SVG de uma curva cúbica. */
export function cubicCurveToPath(curve: LinkCubicCurve) {
    return `M ${curve.p0x} ${curve.p0y} C ${curve.p1x} ${curve.p1y} ${curve.p2x} ${curve.p2y} ${curve.p3x} ${curve.p3y}`;
}

/** Calcula um ponto da curva cúbica para um parâmetro t. */
export function cubicBezier(curve: LinkCubicCurve, t: number) {
    const t1 = 1 - t;
    return {
        x: t1 * t1 * t1 * curve.p0x
            + 3 * t1 * t1 * t * curve.p1x
            + 3 * t1 * t * t * curve.p2x
            + t * t * t * curve.p3x,
        y: t1 * t1 * t1 * curve.p0y
            + 3 * t1 * t1 * t * curve.p1y
            + 3 * t1 * t * t * curve.p2y
            + t * t * t * curve.p3y,
    };
}

/** Calcula a tangente da curva cúbica para um parâmetro t. */
export function cubicBezierTangent(curve: LinkCubicCurve, t: number) {
    const t1 = 1 - t;
    return {
        x: 3 * t1 * t1 * (curve.p1x - curve.p0x)
            + 6 * t1 * t * (curve.p2x - curve.p1x)
            + 3 * t * t * (curve.p3x - curve.p2x),
        y: 3 * t1 * t1 * (curve.p1y - curve.p0y)
            + 6 * t1 * t * (curve.p2y - curve.p1y)
            + 3 * t * t * (curve.p3y - curve.p2y),
    };
}

/** Calcula a normal unitária da curva cúbica para um parâmetro t. */
export function normalAt(curve: LinkCubicCurve, t: number): Vector2Like {
    const tangent = cubicBezierTangent(curve, t);
    const magnitude = Math.hypot(tangent.x, tangent.y) || 1;
    return {
        x: -tangent.y / magnitude,
        y: tangent.x / magnitude,
    };
}

/** Constrói uma tabela acumulada de comprimento ao longo da curva. */
export function buildLengthTable(curve: LinkCubicCurve, n: number) {
    const table = new Float64Array(n + 1);
    table[0] = 0;
    let previous = { x: curve.p0x, y: curve.p0y };

    for (let index = 1; index <= n; index++) {
        const t = index / n;
        const point = cubicBezier(curve, t);
        table[index] = table[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y);
        previous = point;
    }

    return table;
}

/** Recupera o parâmetro t aproximado para um comprimento alvo na tabela. */
export function parameterAtLength(table: Float64Array, targetLength: number) {
    const lastIndex = table.length - 1;
    if (targetLength <= 0) return 0;
    if (targetLength >= table[lastIndex]) return 1;

    let low = 0;
    let high = lastIndex;

    while (low < high - 1) {
        const middle = (low + high) >> 1;
        if (table[middle] < targetLength) {
            low = middle;
        } else {
            high = middle;
        }
    }

    const segmentLength = table[high] - table[low];
    const ratio = segmentLength > 0 ? (targetLength - table[low]) / segmentLength : 0;
    return (low + ratio) / lastIndex;
}

/** Amostra pontos deslocados ao longo da curva usando a normal local. */
export function sampleOffsetPoints(curve: LinkCubicCurve, offset: number, steps: number) {
    const safeSteps = Math.max(1, Math.floor(steps));
    const points: SampledPoint[] = [];

    for (let index = 0; index <= safeSteps; index++) {
        const t = index / safeSteps;
        const point = cubicBezier(curve, t);
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

/** Calcula o menor retângulo que contém todos os pontos. */
export function getBoundsFromPoints(points: CurvePoint[]): Bounds {
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

/** Normaliza a posição de label do intervalo [-1, 1] para [0, 1]. */
export function normalizeLabelPosition(position: number) {
    return Math.max(0, Math.min(1, (position + 1) / 2));
}

/**
 * Converte uma sequência de pontos em um path cúbico suave com tangentes fixas
 * nas extremidades e continuidade visual nos pontos internos.
 */
export function pointsToSplinePath(points: CurvePoint[], options: PointSplineOptions = {}) {
    if (points.length < 2) return "";

    const lastIndex = points.length - 1;
    const startNeighbor = {
        x: points[1].x - points[0].x,
        y: points[1].y - points[0].y,
    };
    const endNeighbor = {
        x: points[lastIndex - 1].x - points[lastIndex].x,
        y: points[lastIndex - 1].y - points[lastIndex].y,
    };
    const startDirection = resolveAnchorDirection(options.startDirection, startNeighbor);
    const endDirection = resolveAnchorDirection(options.endDirection, endNeighbor);
    const startHandleDistance = resolveEndpointHandleDistance(startDirection, startNeighbor);
    const endHandleDistance = resolveEndpointHandleDistance(endDirection, endNeighbor);
    const internalAxes = points.map((point, index) => {
        if (index === 0 || index === lastIndex) {
            return null;
        }

        return resolveInternalAxis(points[index - 1], point, points[index + 1]);
    });
    const previousHandleDistances = points.map((point, index) => {
        if (index === 0) {
            return 0;
        }

        return Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) * INTERNAL_HANDLE_RATIO;
    });
    const nextHandleDistances = points.map((point, index) => {
        if (index === lastIndex) {
            return 0;
        }

        return Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y) * INTERNAL_HANDLE_RATIO;
    });

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let index = 0; index < lastIndex; index++) {
        const start = points[index];
        const end = points[index + 1];
        const startAxis = index === 0
            ? startDirection
            : internalAxes[index] ?? normalizeVector(end.x - start.x, end.y - start.y);
        const endAxis = index === lastIndex - 1
            ? endDirection
            : internalAxes[index + 1] ?? normalizeVector(end.x - start.x, end.y - start.y);
        const firstControl = controlPoint(
            start.x,
            start.y,
            startAxis,
            index === 0 ? startHandleDistance : nextHandleDistances[index],
        );
        const secondControl = controlPoint(
            end.x,
            end.y,
            index === lastIndex - 1
                ? endAxis
                : { x: -endAxis.x, y: -endAxis.y },
            index === lastIndex - 1 ? endHandleDistance : previousHandleDistances[index + 1],
        );

        d += ` C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${end.x} ${end.y}`;
    }

    return d;
}

/** Resolve a curva padrão do preview a partir de duas âncoras do grafo. */
export function resolveFixedTangentCurveFromAnchors(from: GraphLinkAnchor, to: GraphLinkAnchor) {
    return resolveFixedTangentCurve({
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        fromVector: from.d,
        toVector: to.d,
    });
}
