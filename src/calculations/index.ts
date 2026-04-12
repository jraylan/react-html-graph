import {
    PathInput,
    PathOutput,
    LabelsInput,
    LabelOutput,
    LayoutInput,
    LayoutOutput,
    FitViewInput,
    FitViewOutput,
    BidirectionalPathInput,
    BidirectionalPathOutput,
    BidirectionalLabelsInput,
    MessageEventData,
    MathProvider,
} from './types';

// Fonte do worker — definida como função para que o TypeScript verifique os
// tipos do seu corpo.
// Em tempo de execução, Function.toString() retorna o JS compilado (sem tipos TS).
// Envolvemos em uma IIFE e carregamos em um Blob Worker.
function workerSource() {
    function quadraticBezier(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, t: number
    ) {
        const t1 = 1 - t;
        return {
            x: t1 * t1 * p0x + 2 * t1 * t * p1x + t * t * p2x,
            y: t1 * t1 * p0y + 2 * t1 * t * p1y + t * t * p2y,
        };
    }

    function quadraticBezierTangent(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, t: number
    ) {
        const t1 = 1 - t;
        return {
            x: 2 * t1 * (p1x - p0x) + 2 * t * (p2x - p1x),
            y: 2 * t1 * (p1y - p0y) + 2 * t * (p2y - p1y),
        };
    }

    function normalAt(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, t: number
    ) {
        const tang = quadraticBezierTangent(p0x, p0y, p1x, p1y, p2x, p2y, t);
        const mag = Math.sqrt(tang.x * tang.x + tang.y * tang.y) || 1;
        return { x: -tang.y / mag, y: tang.x / mag };
    }

    function buildLengthTable(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, n: number
    ) {
        const table = new Float64Array(n + 1);
        table[0] = 0;
        let prevX = p0x, prevY = p0y;
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            const pt = quadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
            const dx = pt.x - prevX, dy = pt.y - prevY;
            table[i] = table[i - 1] + Math.sqrt(dx * dx + dy * dy);
            prevX = pt.x;
            prevY = pt.y;
        }
        return table;
    }

    function parameterAtLength(table: Float64Array, targetLen: number) {
        const n = table.length - 1;
        if (targetLen <= 0) return 0;
        if (targetLen >= table[n]) return 1;
        let lo = 0, hi = n;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (table[mid] < targetLen) lo = mid;
            else hi = mid;
        }
        const segLen = table[hi] - table[lo];
        const frac = segLen > 0 ? (targetLen - table[lo]) / segLen : 0;
        return (lo + frac) / n;
    }

    function sampleOffsetPoints(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number,
        offset: number, steps: number
    ) {
        const safeSteps = Math.max(1, Math.floor(steps));
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= safeSteps; i++) {
            const t = i / safeSteps;
            const pt = quadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
            const n = normalAt(p0x, p0y, p1x, p1y, p2x, p2y, t);
            points.push({ x: pt.x + n.x * offset, y: pt.y + n.y * offset });
        }
        return points;
    }

    function pointsToQuadraticPath(points: { x: number; y: number }[]) {
        if (points.length < 2) return "";

        let d = "M " + points[0].x + " " + points[0].y;
        if (points.length === 2) {
            const controlX = (points[0].x + points[1].x) / 2;
            const controlY = (points[0].y + points[1].y) / 2;
            return d + " Q " + controlX + " " + controlY + " " + points[1].x + " " + points[1].y;
        }

        for (let i = 1; i < points.length - 1; i++) {
            const control = points[i];
            const next = points[i + 1];
            const midpointX = (control.x + next.x) / 2;
            const midpointY = (control.y + next.y) / 2;
            d += " Q " + control.x + " " + control.y + " " + midpointX + " " + midpointY;
        }

        const lastControl = points[points.length - 2];
        const lastPoint = points[points.length - 1];
        d += " Q " + lastControl.x + " " + lastControl.y + " " + lastPoint.x + " " + lastPoint.y;

        return d;
    }

    // eslint-disable-next-line no-restricted-globals
    const post = (self as any).postMessage.bind(self);

    function normalizeVector(x: number, y: number) {
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude === 0) {
            return { x: 0, y: 0 };
        }

        return {
            x: x / magnitude,
            y: y / magnitude,
        };
    }

    function directionToVector(dir: string) {
        switch (dir) {
            case "right": return { x: 1, y: 0 };
            case "left": return { x: -1, y: 0 };
            case "bottom": return { x: 0, y: 1 };
            case "top": return { x: 0, y: -1 };
            default: return { x: 0, y: 0 };
        }
    }

    // Calcula control point baseado no vetor da porta
    function controlPoint(
        x: number, y: number, vector: { x: number; y: number }, dist: number
    ): { x: number; y: number } {
        return {
            x: x + vector.x * dist,
            y: y + vector.y * dist,
        };
    }

    function inferPathVectors(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ) {
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

    function resolvePathVectors(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        fromVector?: { x: number; y: number },
        toVector?: { x: number; y: number },
        fromDir?: string,
        toDir?: string,
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

    function resolveQuadraticCurve(input: {
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        fromVector?: { x: number; y: number };
        toVector?: { x: number; y: number };
        fromDir?: string;
        toDir?: string;
    }) {
        const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir } = input;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const cpDist = Math.max(50, dist * 0.4);
        const vectors = resolvePathVectors(fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir);
        const cubicCp1 = controlPoint(fromX, fromY, vectors.fromVector, cpDist);
        const cubicCp2 = controlPoint(toX, toY, vectors.toVector, cpDist);

        return {
            p0x: fromX,
            p0y: fromY,
            p1x: (-fromX + cubicCp1.x * 3 + cubicCp2.x * 3 - toX) / 4,
            p1y: (-fromY + cubicCp1.y * 3 + cubicCp2.y * 3 - toY) / 4,
            p2x: toX,
            p2y: toY,
        };
    }

    type WorkerLayoutNode = {
        id: string;
        width: number;
        height: number;
        x: number;
        y: number;
        z: number;
    };

    type WorkerLayoutLink = {
        id: string;
        from: string;
        to: string;
    };

    type WorkerLayoutPosition = {
        id: string;
        x: number;
        y: number;
        z: number;
    };

    type WorkerLayoutEdge = {
        fromIndex: number;
        toIndex: number;
    };

    function sortNodeIds(nodes: WorkerLayoutNode[]) {
        return nodes.map(node => node.id);
    }

    function buildGraphIndex(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[]) {
        const outgoing = new Map<string, string[]>();
        const incoming = new Map<string, string[]>();
        const undirected = new Map<string, string[]>();
        const indegree = new Map<string, number>();
        const nodeIds = new Set(nodes.map(node => node.id));

        for (const node of nodes) {
            outgoing.set(node.id, []);
            incoming.set(node.id, []);
            undirected.set(node.id, []);
            indegree.set(node.id, 0);
        }

        for (const link of links) {
            if (!nodeIds.has(link.from) || !nodeIds.has(link.to)) continue;
            outgoing.get(link.from)?.push(link.to);
            incoming.get(link.to)?.push(link.from);
            undirected.get(link.from)?.push(link.to);
            undirected.get(link.to)?.push(link.from);
            indegree.set(link.to, (indegree.get(link.to) ?? 0) + 1);
        }

        return { outgoing, incoming, undirected, indegree };
    }

    function getLayoutBounds(nodes: WorkerLayoutNode[], positions: WorkerLayoutPosition[]) {
        if (nodes.length === 0 || positions.length === 0) {
            return { left: 0, top: 0, width: 0, height: 0 };
        }

        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        for (const position of positions) {
            const node = nodeMap.get(position.id);
            if (!node) continue;
            left = Math.min(left, position.x);
            top = Math.min(top, position.y);
            right = Math.max(right, position.x + node.width);
            bottom = Math.max(bottom, position.y + node.height);
        }

        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
            return { left: 0, top: 0, width: 0, height: 0 };
        }

        return {
            left,
            top,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top),
        };
    }

    function getConnectedComponents(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[]) {
        const { undirected } = buildGraphIndex(nodes, links);
        const visited = new Set<string>();
        const components: string[][] = [];

        for (const node of nodes) {
            if (visited.has(node.id)) continue;
            const queue = [node.id];
            const component: string[] = [];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;
                visited.add(current);
                component.push(current);

                for (const next of undirected.get(current) ?? []) {
                    if (!visited.has(next)) {
                        queue.push(next);
                    }
                }
            }

            components.push(component);
        }

        return components;
    }

    function packDisconnectedComponents(
        nodes: WorkerLayoutNode[],
        links: WorkerLayoutLink[],
        positions: WorkerLayoutPosition[],
        options: any = {}
    ) {
        const components = getConnectedComponents(nodes, links);
        if (components.length <= 1) return positions;

        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const positionMap = new Map(positions.map(position => [position.id, position]));
        const gapX = Math.max(options.gapX ?? 140, 60);
        const gapY = Math.max(options.gapY ?? 100, 60);

        const componentEntries = components.map(ids => {
            const componentPositions = ids
                .map(id => positionMap.get(id))
                .filter((position): position is WorkerLayoutPosition => Boolean(position));
            const componentNodes = ids
                .map(id => nodeMap.get(id))
                .filter((node): node is WorkerLayoutNode => Boolean(node));
            const bounds = getLayoutBounds(componentNodes, componentPositions);
            return {
                ids,
                bounds,
                area: Math.max(1, bounds.width * bounds.height),
            };
        }).sort((a, b) => b.area - a.area);

        const totalArea = componentEntries.reduce((sum, entry) => sum + entry.area, 0);
        const maxComponentWidth = componentEntries.reduce((max, entry) => Math.max(max, entry.bounds.width), 0);
        const targetRowWidth = Math.max(maxComponentWidth, Math.sqrt(totalArea) * 1.25);

        let cursorX = 0;
        let cursorY = 0;
        let rowHeight = 0;
        const componentOffsetMap = new Map<string, { x: number; y: number }>();

        for (const entry of componentEntries) {
            if (cursorX > 0 && cursorX + entry.bounds.width > targetRowWidth) {
                cursorX = 0;
                cursorY += rowHeight + gapY;
                rowHeight = 0;
            }

            const offset = {
                x: cursorX - entry.bounds.left,
                y: cursorY - entry.bounds.top,
            };
            for (const id of entry.ids) {
                componentOffsetMap.set(id, offset);
            }

            cursorX += entry.bounds.width + gapX;
            rowHeight = Math.max(rowHeight, entry.bounds.height);
        }

        return positions.map(position => {
            const offset = componentOffsetMap.get(position.id);
            if (!offset) return position;
            return {
                ...position,
                x: position.x + offset.x,
                y: position.y + offset.y,
            };
        });
    }

    function normalizeLayout(
        nodes: WorkerLayoutNode[],
        positions: WorkerLayoutPosition[],
        options: {
            padding?: number;
            center?: { x: number; y: number };
        } = {}
    ) {
        const padding = options.padding ?? 48;
        const bounds = getLayoutBounds(nodes, positions);
        const offsetX = options.center
            ? options.center.x - (bounds.left + bounds.width / 2)
            : padding - bounds.left;
        const offsetY = options.center
            ? options.center.y - (bounds.top + bounds.height / 2)
            : padding - bounds.top;

        const normalized = positions.map(position => ({
            ...position,
            x: position.x + offsetX,
            y: position.y + offsetY,
        }));

        return {
            positions: normalized,
            bounds: getLayoutBounds(nodes, normalized),
        };
    }

    function flipLayout(
        nodes: WorkerLayoutNode[],
        positions: WorkerLayoutPosition[],
        axis: "x" | "y"
    ) {
        const bounds = getLayoutBounds(nodes, positions);
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        return positions.map(position => {
            const node = nodeMap.get(position.id);
            if (!node) return position;
            if (axis === "x") {
                return {
                    ...position,
                    x: bounds.left + bounds.width - (position.x - bounds.left) - node.width,
                };
            }
            return {
                ...position,
                y: bounds.top + bounds.height - (position.y - bounds.top) - node.height,
            };
        });
    }

    function getTopologicalOrder(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[]) {
        const { outgoing, indegree } = buildGraphIndex(nodes, links);
        const fallbackOrder = sortNodeIds(nodes);
        const pending = new Map(indegree);
        const queue = fallbackOrder.filter(id => (pending.get(id) ?? 0) === 0);
        const order: string[] = [];

        while (queue.length > 0) {
            const id = queue.shift()!;
            order.push(id);
            for (const next of outgoing.get(id) ?? []) {
                const newDegree = (pending.get(next) ?? 0) - 1;
                pending.set(next, newDegree);
                if (newDegree === 0) {
                    queue.push(next);
                    queue.sort((a, b) => fallbackOrder.indexOf(a) - fallbackOrder.indexOf(b));
                }
            }
        }

        for (const id of fallbackOrder) {
            if (!order.includes(id)) order.push(id);
        }

        return order;
    }

    function getHierarchicalDepths(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[], treeMode: boolean) {
        const { outgoing, indegree } = buildGraphIndex(nodes, links);
        const order = getTopologicalOrder(nodes, links);
        const depths = new Map<string, number>();
        const fallbackOrder = sortNodeIds(nodes);

        for (const id of fallbackOrder) {
            depths.set(id, 0);
        }

        if (treeMode) {
            const roots = fallbackOrder.filter(id => (indegree.get(id) ?? 0) === 0);
            const queue = [...roots, ...fallbackOrder.filter(id => !roots.includes(id))];
            const visited = new Set<string>();

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;
                visited.add(current);
                const baseDepth = depths.get(current) ?? 0;
                for (const next of outgoing.get(current) ?? []) {
                    if ((depths.get(next) ?? 0) < baseDepth + 1) {
                        depths.set(next, baseDepth + 1);
                    }
                    queue.push(next);
                }
            }

            return depths;
        }

        for (const id of order) {
            const depth = depths.get(id) ?? 0;
            for (const next of outgoing.get(id) ?? []) {
                if ((depths.get(next) ?? 0) < depth + 1) {
                    depths.set(next, depth + 1);
                }
            }
        }

        return depths;
    }

    function getViewportScales(options: any = {}) {
        const viewportWidth = options.viewport?.width ?? 0;
        const viewportHeight = options.viewport?.height ?? 0;
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return { scaleX: 1, scaleY: 1 };
        }

        if (viewportWidth >= viewportHeight) {
            return {
                scaleX: Math.min(viewportWidth / viewportHeight, 1.8),
                scaleY: 1,
            };
        }

        return {
            scaleX: 1,
            scaleY: Math.min(viewportHeight / viewportWidth, 1.8),
        };
    }

    function getLayoutDirection(
        options: any = {},
        fallback: "LR" | "TB",
        respectViewport = true,
    ) {
        if (options.direction) return options.direction;
        if (!respectViewport) return fallback;
        const viewportWidth = options.viewport?.width ?? 0;
        const viewportHeight = options.viewport?.height ?? 0;
        if (viewportWidth <= 0 || viewportHeight <= 0) return fallback;
        return viewportWidth >= viewportHeight ? "LR" : "TB";
    }

    function buildLayerOrderIndex(layers: Map<number, string[]>) {
        const layerOrderIndex = new Map<string, number>();

        for (const ids of layers.values()) {
            ids.forEach((id, index) => {
                layerOrderIndex.set(id, index);
            });
        }

        return layerOrderIndex;
    }

    function getNeighborBarycenter(
        nodeId: string,
        depths: Map<string, number>,
        neighbors: Map<string, string[]>,
        layerOrderIndex: Map<string, number>,
        currentDepth: number,
        relation: "before" | "after",
    ) {
        const positions = (neighbors.get(nodeId) ?? [])
            .filter(neighborId => {
                const neighborDepth = depths.get(neighborId);
                if (neighborDepth === undefined) return false;
                return relation === "before"
                    ? neighborDepth < currentDepth
                    : neighborDepth > currentDepth;
            })
            .map(neighborId => layerOrderIndex.get(neighborId))
            .filter((value): value is number => value !== undefined);

        if (positions.length === 0) return null;
        return positions.reduce((sum, value) => sum + value, 0) / positions.length;
    }

    function reorderLayerByBarycenter(
        ids: string[],
        depths: Map<string, number>,
        neighbors: Map<string, string[]>,
        layerOrderIndex: Map<string, number>,
        fallbackOrderIndex: Map<string, number>,
        currentDepth: number,
        relation: "before" | "after",
    ) {
        return [...ids].sort((leftId, rightId) => {
            const leftBarycenter = getNeighborBarycenter(
                leftId,
                depths,
                neighbors,
                layerOrderIndex,
                currentDepth,
                relation,
            );
            const rightBarycenter = getNeighborBarycenter(
                rightId,
                depths,
                neighbors,
                layerOrderIndex,
                currentDepth,
                relation,
            );

            if (
                leftBarycenter !== null
                && rightBarycenter !== null
                && leftBarycenter !== rightBarycenter
            ) {
                return leftBarycenter - rightBarycenter;
            }

            if (leftBarycenter !== null) return -1;
            if (rightBarycenter !== null) return 1;

            return (fallbackOrderIndex.get(leftId) ?? 0) - (fallbackOrderIndex.get(rightId) ?? 0);
        });
    }

    function optimizeHierarchicalLayerOrder(
        layers: Map<number, string[]>,
        depths: Map<string, number>,
        incoming: Map<string, string[]>,
        outgoing: Map<string, string[]>,
        fallbackOrderIndex: Map<string, number>,
    ) {
        const layerKeys = [...layers.keys()].sort((a, b) => a - b);
        if (layerKeys.length <= 1) return layers;

        for (let sweep = 0; sweep < 4; sweep++) {
            let layerOrderIndex = buildLayerOrderIndex(layers);

            for (let index = 1; index < layerKeys.length; index++) {
                const depth = layerKeys[index];
                const ids = layers.get(depth) ?? [];
                layers.set(
                    depth,
                    reorderLayerByBarycenter(
                        ids,
                        depths,
                        incoming,
                        layerOrderIndex,
                        fallbackOrderIndex,
                        depth,
                        "before",
                    ),
                );
                layerOrderIndex = buildLayerOrderIndex(layers);
            }

            layerOrderIndex = buildLayerOrderIndex(layers);

            for (let index = layerKeys.length - 2; index >= 0; index--) {
                const depth = layerKeys[index];
                const ids = layers.get(depth) ?? [];
                layers.set(
                    depth,
                    reorderLayerByBarycenter(
                        ids,
                        depths,
                        outgoing,
                        layerOrderIndex,
                        fallbackOrderIndex,
                        depth,
                        "after",
                    ),
                );
                layerOrderIndex = buildLayerOrderIndex(layers);
            }
        }

        return layers;
    }

    function layoutSequential(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[], options: any = {}) {
        const gapX = options.gapX ?? 80;
        const gapY = options.gapY ?? 80;
        const order = getTopologicalOrder(nodes, links);
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const viewportWidth = options.viewport?.width ?? 0;
        const viewportHeight = options.viewport?.height ?? 0;
        const aspect = viewportWidth > 0 && viewportHeight > 0 ? viewportWidth / viewportHeight : 1;
        const defaultColumns = Math.ceil(Math.sqrt(Math.max(1, nodes.length)) * Math.sqrt(Math.max(aspect, 0.5)));
        const columns = Math.max(1, Math.floor(options.columns ?? defaultColumns));

        let x = 0;
        let y = 0;
        let rowHeight = 0;
        let column = 0;
        const positions: WorkerLayoutPosition[] = [];

        for (const id of order) {
            const node = nodeMap.get(id);
            if (!node) continue;
            positions.push({ id, x, y, z: node.z });
            rowHeight = Math.max(rowHeight, node.height);
            column += 1;

            if (column >= columns) {
                column = 0;
                x = 0;
                y += rowHeight + gapY;
                rowHeight = 0;
            } else {
                x += node.width + gapX;
            }
        }

        return normalizeLayout(nodes, packDisconnectedComponents(nodes, links, positions, options), options);
    }

    function layoutHierarchical(
        nodes: WorkerLayoutNode[],
        links: WorkerLayoutLink[],
        options: any = {},
        treeMode = false,
        respectViewport = false,
    ) {
        const { outgoing, incoming } = buildGraphIndex(nodes, links);
        const gapX = options.gapX ?? 100;
        const gapY = options.gapY ?? 80;
        const direction = getLayoutDirection(options, treeMode ? "TB" : "LR", respectViewport);
        const depths = getHierarchicalDepths(nodes, links, treeMode);
        const order = sortNodeIds(nodes);
        const fallbackOrderIndex = new Map(order.map((id, index) => [id, index]));
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const layers = new Map<number, string[]>();

        for (const id of order) {
            const depth = depths.get(id) ?? 0;
            const group = layers.get(depth) ?? [];
            group.push(id);
            layers.set(depth, group);
        }

        optimizeHierarchicalLayerOrder(layers, depths, incoming, outgoing, fallbackOrderIndex);

        const layerKeys = [...layers.keys()].sort((a, b) => a - b);
        const positions: WorkerLayoutPosition[] = [];
        let primaryCursor = 0;

        for (const layerKey of layerKeys) {
            const ids = layers.get(layerKey) ?? [];
            let secondaryCursor = 0;
            let primarySize = 0;

            for (const id of ids) {
                const node = nodeMap.get(id);
                if (!node) continue;

                if (direction === "LR" || direction === "RL") {
                    positions.push({ id, x: primaryCursor, y: secondaryCursor, z: node.z });
                    secondaryCursor += node.height + gapY;
                    primarySize = Math.max(primarySize, node.width);
                } else {
                    positions.push({ id, x: secondaryCursor, y: primaryCursor, z: node.z });
                    secondaryCursor += node.width + gapX;
                    primarySize = Math.max(primarySize, node.height);
                }
            }

            primaryCursor += primarySize + (direction === "LR" || direction === "RL" ? gapX : gapY);
        }

        let adjusted = positions;
        if (direction === "RL") adjusted = flipLayout(nodes, adjusted, "x");
        if (direction === "BT") adjusted = flipLayout(nodes, adjusted, "y");

        return normalizeLayout(nodes, packDisconnectedComponents(nodes, links, adjusted, options), options);
    }

    function layoutTree(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[], options: any = {}) {
        const { outgoing, incoming, indegree } = buildGraphIndex(nodes, links);
        const gapX = options.gapX ?? 100;
        const gapY = options.gapY ?? 80;
        const direction = getLayoutDirection(options, "TB", false);
        const depths = getHierarchicalDepths(nodes, links, true);
        const order = sortNodeIds(nodes);
        const fallbackOrderIndex = new Map(order.map((id, index) => [id, index]));
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const layers = new Map<number, string[]>();

        for (const id of order) {
            const depth = depths.get(id) ?? 0;
            const group = layers.get(depth) ?? [];
            group.push(id);
            layers.set(depth, group);
        }

        optimizeHierarchicalLayerOrder(layers, depths, incoming, outgoing, fallbackOrderIndex);

        const layerOrderIndex = buildLayerOrderIndex(layers);
        const roots = order.filter(id => (indegree.get(id) ?? 0) === 0);
        const rootSet = new Set(roots);
        const forestRoots: string[] = [];
        const assigned = new Set<string>();
        const children = new Map<string, string[]>();

        const sortByTreeOrder = (leftId: string, rightId: string) => {
            const leftDepth = depths.get(leftId) ?? 0;
            const rightDepth = depths.get(rightId) ?? 0;
            if (leftDepth !== rightDepth) return leftDepth - rightDepth;
            return (layerOrderIndex.get(leftId) ?? fallbackOrderIndex.get(leftId) ?? 0)
                - (layerOrderIndex.get(rightId) ?? fallbackOrderIndex.get(rightId) ?? 0);
        };

        const buildTree = (nodeId: string) => {
            const currentDepth = depths.get(nodeId) ?? 0;
            const childIds = (outgoing.get(nodeId) ?? [])
                .filter(childId => childId !== nodeId && (depths.get(childId) ?? currentDepth) > currentDepth && !assigned.has(childId))
                .sort(sortByTreeOrder);

            children.set(nodeId, childIds);

            for (const childId of childIds) {
                assigned.add(childId);
                buildTree(childId);
            }
        };

        for (const rootId of [...roots, ...order.filter(id => !rootSet.has(id))]) {
            if (assigned.has(rootId)) continue;
            assigned.add(rootId);
            forestRoots.push(rootId);
            buildTree(rootId);
        }

        const layerKeys = [...layers.keys()].sort((a, b) => a - b);
        const primaryOffsetByDepth = new Map<number, number>();
        let primaryCursor = 0;

        for (const layerKey of layerKeys) {
            const ids = layers.get(layerKey) ?? [];
            const primarySize = ids.reduce((max, id) => {
                const node = nodeMap.get(id);
                if (!node) return max;
                return Math.max(max, direction === "LR" || direction === "RL" ? node.width : node.height);
            }, 0);

            primaryOffsetByDepth.set(layerKey, primaryCursor);
            primaryCursor += primarySize + (direction === "LR" || direction === "RL" ? gapX : gapY);
        }

        const secondaryGap = direction === "LR" || direction === "RL" ? gapY : gapX;
        const secondarySize = (nodeId: string) => {
            const node = nodeMap.get(nodeId);
            if (!node) return 0;
            return direction === "LR" || direction === "RL" ? node.height : node.width;
        };

        const secondaryPositionById = new Map<string, number>();
        let secondaryCursor = 0;

        const placeSubtree = (nodeId: string): { start: number; end: number } => {
            const node = nodeMap.get(nodeId);
            if (!node) {
                return { start: secondaryCursor, end: secondaryCursor };
            }

            const nodeSecondarySize = secondarySize(nodeId);
            const childIds = children.get(nodeId) ?? [];

            if (childIds.length === 0) {
                const start = secondaryCursor;
                secondaryPositionById.set(nodeId, start);
                secondaryCursor += nodeSecondarySize + secondaryGap;
                return { start, end: start + nodeSecondarySize };
            }

            let start = Infinity;
            let end = -Infinity;

            for (const childId of childIds) {
                const bounds = placeSubtree(childId);
                start = Math.min(start, bounds.start);
                end = Math.max(end, bounds.end);
            }

            const centeredStart = start + (end - start - nodeSecondarySize) / 2;
            secondaryPositionById.set(nodeId, centeredStart);

            return {
                start: Math.min(start, centeredStart),
                end: Math.max(end, centeredStart + nodeSecondarySize),
            };
        };

        for (const rootId of forestRoots) {
            placeSubtree(rootId);
            secondaryCursor += secondaryGap;
        }

        const positions = order
            .map(id => {
                const node = nodeMap.get(id);
                if (!node) return null;

                const depth = depths.get(id) ?? 0;
                const primary = primaryOffsetByDepth.get(depth) ?? 0;
                const secondary = secondaryPositionById.get(id) ?? 0;

                if (direction === "LR" || direction === "RL") {
                    return { id, x: primary, y: secondary, z: node.z } satisfies WorkerLayoutPosition;
                }

                return { id, x: secondary, y: primary, z: node.z } satisfies WorkerLayoutPosition;
            })
            .filter((position): position is WorkerLayoutPosition => Boolean(position));

        let adjusted = positions;
        if (direction === "RL") adjusted = flipLayout(nodes, adjusted, "x");
        if (direction === "BT") adjusted = flipLayout(nodes, adjusted, "y");

        return normalizeLayout(nodes, packDisconnectedComponents(nodes, links, adjusted, options), options);
    }

    function layoutRadial(nodes: WorkerLayoutNode[], links: WorkerLayoutLink[], options: any = {}) {
        const { outgoing, incoming, indegree, undirected } = buildGraphIndex(nodes, links);
        const order = sortNodeIds(nodes);
        const orderIndex = new Map(order.map((id, index) => [id, index]));
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const { scaleX, scaleY } = getViewportScales(options);
        const radiusStep = options.radiusStep ?? Math.max((options.gapX ?? 96) * 0.8, (options.gapY ?? 80) * 0.8, 72);
        const angularGap = Math.max((options.gapX ?? 96) * 0.2, 16);
        const positions: WorkerLayoutPosition[] = [];

        const adjacency = new Map<string, string[]>();
        for (const node of nodes) {
            const combined = [
                ...(outgoing.get(node.id) ?? []),
                ...(incoming.get(node.id) ?? []),
                ...(undirected.get(node.id) ?? []),
            ];
            adjacency.set(
                node.id,
                [...new Set(combined)].sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0))
            );
        }

        const components = getConnectedComponents(nodes, links);

        for (const component of components) {
            const componentSet = new Set(component);
            const root = component.find(id => (indegree.get(id) ?? 0) === 0) ?? component[0];
            const children = new Map<string, string[]>();
            const depth = new Map<string, number>();
            const visited = new Set<string>();

            const buildTree = (nodeId: string, parentId?: string, currentDepth = 0) => {
                visited.add(nodeId);
                depth.set(nodeId, currentDepth);

                const childIds = (adjacency.get(nodeId) ?? [])
                    .filter(next => componentSet.has(next) && next !== parentId && !visited.has(next));

                children.set(nodeId, childIds);
                for (const childId of childIds) {
                    buildTree(childId, nodeId, currentDepth + 1);
                }
            };

            buildTree(root);

            const subtreeWeight = new Map<string, number>();
            const calculateWeight = (nodeId: string): number => {
                const childIds = children.get(nodeId) ?? [];
                if (childIds.length === 0) {
                    subtreeWeight.set(nodeId, 1);
                    return 1;
                }

                const weight = childIds.reduce((sum, childId) => sum + calculateWeight(childId), 0);
                subtreeWeight.set(nodeId, Math.max(1, weight));
                return Math.max(1, weight);
            };

            calculateWeight(root);

            const angle = new Map<string, number>();
            const assignAngles = (nodeId: string, startAngle: number, endAngle: number) => {
                angle.set(nodeId, (startAngle + endAngle) / 2);
                const childIds = children.get(nodeId) ?? [];
                if (childIds.length === 0) return;

                const totalWeight = childIds.reduce((sum, childId) => sum + (subtreeWeight.get(childId) ?? 1), 0);
                let cursor = startAngle;
                for (const childId of childIds) {
                    const span = ((endAngle - startAngle) * (subtreeWeight.get(childId) ?? 1)) / Math.max(totalWeight, 1);
                    assignAngles(childId, cursor, cursor + span);
                    cursor += span;
                }
            };

            assignAngles(root, -Math.PI / 2, (Math.PI * 3) / 2);

            const layers = new Map<number, string[]>();
            for (const nodeId of component) {
                const layer = depth.get(nodeId) ?? 0;
                const group = layers.get(layer) ?? [];
                group.push(nodeId);
                layers.set(layer, group);
            }

            const layerKeys = [...layers.keys()].sort((a, b) => a - b);
            const radiusByLayer = new Map<number, number>();
            let outerRadius = 0;

            for (const layer of layerKeys) {
                const layerIds = layers.get(layer) ?? [];
                if (layer === 0) {
                    radiusByLayer.set(layer, 0);
                    const rootNode = nodeMap.get(root);
                    outerRadius = rootNode
                        ? Math.sqrt(rootNode.width * rootNode.width + rootNode.height * rootNode.height) / 2
                        : 0;
                    continue;
                }

                const sortedLayerIds = [...layerIds].sort((a, b) => (angle.get(a) ?? 0) - (angle.get(b) ?? 0));
                let layerRadius = outerRadius + radiusStep;

                if (sortedLayerIds.length > 1) {
                    for (let index = 0; index < sortedLayerIds.length; index++) {
                        const currentId = sortedLayerIds[index];
                        const nextId = sortedLayerIds[(index + 1) % sortedLayerIds.length];
                        const currentNode = nodeMap.get(currentId);
                        const nextNode = nodeMap.get(nextId);
                        if (!currentNode || !nextNode) continue;

                        const currentAngle = angle.get(currentId) ?? 0;
                        const nextAngle = angle.get(nextId) ?? 0;
                        const angleDeltaRaw = nextAngle > currentAngle
                            ? nextAngle - currentAngle
                            : nextAngle + Math.PI * 2 - currentAngle;
                        const angleDelta = Math.max(angleDeltaRaw, 0.2);
                        const requiredArc = (
                            Math.sqrt(currentNode.width * currentNode.width + currentNode.height * currentNode.height) / 2 +
                            Math.sqrt(nextNode.width * nextNode.width + nextNode.height * nextNode.height) / 2 +
                            angularGap
                        );
                        layerRadius = Math.max(layerRadius, requiredArc / angleDelta);
                    }
                }

                radiusByLayer.set(layer, layerRadius);
                const maxHalfDiagonal = layerIds.reduce((max, nodeId) => {
                    const node = nodeMap.get(nodeId);
                    if (!node) return max;
                    return Math.max(max, Math.sqrt(node.width * node.width + node.height * node.height) / 2);
                }, 0);
                outerRadius = layerRadius + maxHalfDiagonal;
            }

            for (const nodeId of component) {
                const node = nodeMap.get(nodeId);
                if (!node) continue;

                const currentDepth = depth.get(nodeId) ?? 0;
                const radius = radiusByLayer.get(currentDepth) ?? 0;
                const theta = angle.get(nodeId) ?? 0;
                positions.push({
                    id: nodeId,
                    x: Math.cos(theta) * radius * scaleX - node.width / 2,
                    y: Math.sin(theta) * radius * scaleY - node.height / 2,
                    z: node.z,
                });
            }
        }

        return normalizeLayout(nodes, packDisconnectedComponents(nodes, links, positions, options), options);
    }

    function separateOverlappingNodes(
        nodes: WorkerLayoutNode[],
        centers: Array<{ x: number; y: number }>,
        gapX: number,
        gapY: number,
    ) {
        for (let iteration = 0; iteration < 12; iteration++) {
            let moved = false;

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const minDx = (nodes[i].width + nodes[j].width) / 2 + gapX * 0.35;
                    const minDy = (nodes[i].height + nodes[j].height) / 2 + gapY * 0.35;
                    const dx = centers[j].x - centers[i].x;
                    const dy = centers[j].y - centers[i].y;
                    const overlapX = minDx - Math.abs(dx);
                    const overlapY = minDy - Math.abs(dy);

                    if (overlapX <= 0 || overlapY <= 0) continue;

                    moved = true;
                    if (overlapX < overlapY) {
                        const shift = overlapX / 2 + 1;
                        const sign = dx >= 0 ? 1 : -1;
                        centers[i].x -= sign * shift;
                        centers[j].x += sign * shift;
                    } else {
                        const shift = overlapY / 2 + 1;
                        const sign = dy >= 0 ? 1 : -1;
                        centers[i].y -= sign * shift;
                        centers[j].y += sign * shift;
                    }
                }
            }

            if (!moved) {
                return;
            }
        }
    }

    function getMidpoint(from: { x: number; y: number }, to: { x: number; y: number }) {
        return {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
        };
    }

    function getNormalizedVector(x: number, y: number) {
        const length = Math.sqrt(x * x + y * y) || 1;
        return { x: x / length, y: y / length };
    }

    function segmentsIntersect(
        leftFrom: { x: number; y: number },
        leftTo: { x: number; y: number },
        rightFrom: { x: number; y: number },
        rightTo: { x: number; y: number },
    ) {
        const epsilon = 0.001;
        const leftToRightFrom = (leftTo.x - leftFrom.x) * (rightFrom.y - leftFrom.y) - (leftTo.y - leftFrom.y) * (rightFrom.x - leftFrom.x);
        const leftToRightTo = (leftTo.x - leftFrom.x) * (rightTo.y - leftFrom.y) - (leftTo.y - leftFrom.y) * (rightTo.x - leftFrom.x);
        const rightToLeftFrom = (rightTo.x - rightFrom.x) * (leftFrom.y - rightFrom.y) - (rightTo.y - rightFrom.y) * (leftFrom.x - rightFrom.x);
        const rightToLeftTo = (rightTo.x - rightFrom.x) * (leftTo.y - rightFrom.y) - (rightTo.y - rightFrom.y) * (leftTo.x - rightFrom.x);

        return (
            ((leftToRightFrom > epsilon && leftToRightTo < -epsilon) || (leftToRightFrom < -epsilon && leftToRightTo > epsilon))
            && ((rightToLeftFrom > epsilon && rightToLeftTo < -epsilon) || (rightToLeftFrom < -epsilon && rightToLeftTo > epsilon))
        );
    }

    function applyLinkCrossingForces(
        edges: WorkerLayoutEdge[],
        centers: Array<{ x: number; y: number }>,
        displacement: Array<{ x: number; y: number }>,
        strength: number,
        seedCenters?: Array<{ x: number; y: number } | null>,
    ) {
        if (strength <= 0 || edges.length < 2) return 0;

        let crossingCount = 0;

        for (let leftIndex = 0; leftIndex < edges.length; leftIndex++) {
            const leftEdge = edges[leftIndex];
            const leftFrom = centers[leftEdge.fromIndex];
            const leftTo = centers[leftEdge.toIndex];

            for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex++) {
                const rightEdge = edges[rightIndex];

                if (
                    leftEdge.fromIndex === rightEdge.fromIndex
                    || leftEdge.fromIndex === rightEdge.toIndex
                    || leftEdge.toIndex === rightEdge.fromIndex
                    || leftEdge.toIndex === rightEdge.toIndex
                ) {
                    continue;
                }

                const rightFrom = centers[rightEdge.fromIndex];
                const rightTo = centers[rightEdge.toIndex];
                if (!segmentsIntersect(leftFrom, leftTo, rightFrom, rightTo)) continue;

                crossingCount += 1;

                const leftMid = getMidpoint(leftFrom, leftTo);
                const rightMid = getMidpoint(rightFrom, rightTo);
                let separationX = leftMid.x - rightMid.x;
                let separationY = leftMid.y - rightMid.y;

                const leftSeedFrom = seedCenters?.[leftEdge.fromIndex];
                const leftSeedTo = seedCenters?.[leftEdge.toIndex];
                const rightSeedFrom = seedCenters?.[rightEdge.fromIndex];
                const rightSeedTo = seedCenters?.[rightEdge.toIndex];

                if (leftSeedFrom && leftSeedTo && rightSeedFrom && rightSeedTo) {
                    const leftSeedMid = getMidpoint(leftSeedFrom, leftSeedTo);
                    const rightSeedMid = getMidpoint(rightSeedFrom, rightSeedTo);
                    separationX = leftSeedMid.x - rightSeedMid.x;
                    separationY = leftSeedMid.y - rightSeedMid.y;
                }

                if (Math.abs(separationX) < 0.001 && Math.abs(separationY) < 0.001) {
                    separationX = (leftFrom.x + leftTo.x) - (rightFrom.x + rightTo.x);
                    separationY = (leftFrom.y + leftTo.y) - (rightFrom.y + rightTo.y);
                }

                const direction = getNormalizedVector(separationX, separationY);
                const pushX = direction.x * strength;
                const pushY = direction.y * strength;

                displacement[leftEdge.fromIndex].x += pushX * 0.5;
                displacement[leftEdge.fromIndex].y += pushY * 0.5;
                displacement[leftEdge.toIndex].x += pushX * 0.5;
                displacement[leftEdge.toIndex].y += pushY * 0.5;
                displacement[rightEdge.fromIndex].x -= pushX * 0.5;
                displacement[rightEdge.fromIndex].y -= pushY * 0.5;
                displacement[rightEdge.toIndex].x -= pushX * 0.5;
                displacement[rightEdge.toIndex].y -= pushY * 0.5;
            }
        }

        return crossingCount;
    }

    function resolveLinkCrossings(
        nodes: WorkerLayoutNode[],
        edges: WorkerLayoutEdge[],
        centers: Array<{ x: number; y: number }>,
        spacing: number,
        gapX: number,
        gapY: number,
        seedCenters?: Array<{ x: number; y: number } | null>,
    ) {
        if (edges.length < 2) return;

        for (let iteration = 0; iteration < 20; iteration++) {
            const displacement = nodes.map(() => ({ x: 0, y: 0 }));
            const crossingCount = applyLinkCrossingForces(
                edges,
                centers,
                displacement,
                Math.max(spacing * 0.12, 6),
                seedCenters,
            );

            if (crossingCount === 0) {
                return;
            }

            for (let index = 0; index < centers.length; index++) {
                centers[index].x += displacement[index].x;
                centers[index].y += displacement[index].y;
            }

            separateOverlappingNodes(nodes, centers, gapX, gapY);
        }
    }

    function runForceLayout(
        nodes: WorkerLayoutNode[],
        links: WorkerLayoutLink[],
        options: any = {},
        directedBias = 0,
        gravity = 0.015,
        seedPositions?: WorkerLayoutPosition[],
    ) {
        const gapX = options.gapX ?? 140;
        const gapY = options.gapY ?? 100;
        const averageNodeSize = nodes.reduce((sum, node) => sum + Math.max(node.width, node.height), 0) / Math.max(nodes.length, 1);
        const baseSpacing = Math.max(gapX, gapY, averageNodeSize * 0.85, 48);
        const overlapGapX = gapX > 0 ? gapX : Math.min(baseSpacing * 0.25, 24);
        const overlapGapY = gapY > 0 ? gapY : Math.min(baseSpacing * 0.25, 24);
        const iterations = Math.max(1, Math.floor(options.iterations ?? 220));
        const nodeMap = new Map(nodes.map((node, index) => [node.id, { node, index }]));
        const { outgoing, incoming } = buildGraphIndex(nodes, links);
        const nodeDegrees = nodes.map(node => {
            const degree = new Set([
                ...(outgoing.get(node.id) ?? []),
                ...(incoming.get(node.id) ?? []),
            ]);
            return degree.size;
        });
        const edges = links
            .map(link => {
                const fromEntry = nodeMap.get(link.from);
                const toEntry = nodeMap.get(link.to);
                if (!fromEntry || !toEntry) return null;
                return {
                    fromIndex: fromEntry.index,
                    toIndex: toEntry.index,
                } satisfies WorkerLayoutEdge;
            })
            .filter((edge): edge is WorkerLayoutEdge => Boolean(edge));
        const nodeRadii = nodes.map(node => Math.sqrt(node.width * node.width + node.height * node.height) / 2);
        const seedPositionMap = new Map((seedPositions ?? []).map(position => [position.id, position]));
        const seedCenters = nodes.map(node => {
            const seed = seedPositionMap.get(node.id);
            if (!seed) return null;

            return {
                x: seed.x + node.width / 2,
                y: seed.y + node.height / 2,
            };
        });
        const rawPositions = nodes.map(node => {
            const seed = seedPositionMap.get(node.id);
            return {
                id: node.id,
                x: seed?.x ?? node.x,
                y: seed?.y ?? node.y,
                z: seed?.z ?? node.z,
            };
        });
        const rawBounds = getLayoutBounds(nodes, rawPositions);
        const rawCenterX = rawBounds.left + rawBounds.width / 2;
        const rawCenterY = rawBounds.top + rawBounds.height / 2;
        const { scaleX, scaleY } = getViewportScales(options);
        const desiredSpanX = baseSpacing * Math.max(2, Math.sqrt(Math.max(1, nodes.length))) * scaleX;
        const desiredSpanY = baseSpacing * Math.max(2, Math.sqrt(Math.max(1, nodes.length))) * scaleY;
        const currentSpanX = Math.max(rawBounds.width, 1);
        const currentSpanY = Math.max(rawBounds.height, 1);
        const compactScaleX = Math.min(1, desiredSpanX / currentSpanX);
        const compactScaleY = Math.min(1, desiredSpanY / currentSpanY);
        const useCircularSeed = rawBounds.width < 4 && rawBounds.height < 4;
        const centers = nodes.map((node, index) => {
            const rawPosition = rawPositions[index] ?? { x: node.x, y: node.y };

            if (useCircularSeed) {
                const seedRadius = baseSpacing * 0.8;
                const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length);
                return {
                    x: Math.cos(angle) * seedRadius * scaleX,
                    y: Math.sin(angle) * seedRadius * scaleY,
                };
            }

            return {
                x: (rawPosition.x + node.width / 2 - rawCenterX) * compactScaleX,
                y: (rawPosition.y + node.height / 2 - rawCenterY) * compactScaleY,
            };
        });

        const totalNodeArea = nodes.reduce((sum, node) => sum + node.width * node.height, 0);
        const area = Math.max(totalNodeArea + baseSpacing * baseSpacing * Math.max(1, nodes.length) * 0.35, 1);
        const k = Math.sqrt(area / Math.max(1, nodes.length));
        let temperature = Math.max(baseSpacing, 60);

        for (let iteration = 0; iteration < iterations; iteration++) {
            const displacement = nodes.map(() => ({ x: 0, y: 0 }));

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    let dx = centers[i].x - centers[j].x;
                    let dy = centers[i].y - centers[j].y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 0.001) {
                        dx = (Math.random() - 0.5) * 0.01;
                        dy = (Math.random() - 0.5) * 0.01;
                        distance = Math.sqrt(dx * dx + dy * dy);
                    }
                    const minimumDistance = nodeRadii[i] + nodeRadii[j] + baseSpacing * 0.18;
                    const safeDistance = Math.max(distance - nodeRadii[i] - nodeRadii[j], 1);
                    const force = (k * k) / (safeDistance * 1.5);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    displacement[i].x += fx;
                    displacement[i].y += fy;
                    displacement[j].x -= fx;
                    displacement[j].y -= fy;

                    if (distance < minimumDistance) {
                        const collisionForce = (minimumDistance - distance) * 1.1;
                        displacement[i].x += (dx / distance) * collisionForce;
                        displacement[i].y += (dy / distance) * collisionForce;
                        displacement[j].x -= (dx / distance) * collisionForce;
                        displacement[j].y -= (dy / distance) * collisionForce;
                    }
                }
            }

            for (const link of links) {
                const fromEntry = nodeMap.get(link.from);
                const toEntry = nodeMap.get(link.to);
                if (!fromEntry || !toEntry) continue;
                const i = fromEntry.index;
                const j = toEntry.index;
                let dx = centers[i].x - centers[j].x;
                let dy = centers[i].y - centers[j].y;
                let distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const springLength = nodeRadii[i] + nodeRadii[j] + baseSpacing * 0.28;
                const force = (distance - springLength) * 0.2;
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                displacement[i].x -= fx;
                displacement[i].y -= fy;
                displacement[j].x += fx;
                displacement[j].y += fy;

                if (directedBias !== 0) {
                    displacement[i].x -= directedBias;
                    displacement[j].x += directedBias;
                }
            }

            if (seedCenters.some(center => center !== null)) {
                const settlingFactor = 0.35 + (iteration / Math.max(iterations - 1, 1)) * 0.85;

                for (let i = 0; i < nodes.length; i++) {
                    const seedCenter = seedCenters[i];
                    if (!seedCenter) continue;

                    const degree = nodeDegrees[i];
                    const leafBias = degree <= 1 ? 1.6 : degree === 2 ? 1.15 : 0.9;
                    const seedStrength = 0.04 * leafBias * settlingFactor;
                    displacement[i].x += (seedCenter.x - centers[i].x) * seedStrength;
                    displacement[i].y += (seedCenter.y - centers[i].y) * seedStrength;
                }
            }

            for (let i = 0; i < nodes.length; i++) {
                displacement[i].x -= centers[i].x * gravity;
                displacement[i].y -= centers[i].y * gravity;
                const length = Math.sqrt(displacement[i].x * displacement[i].x + displacement[i].y * displacement[i].y) || 1;
                const limited = Math.min(length, temperature);
                centers[i].x += (displacement[i].x / length) * limited;
                centers[i].y += (displacement[i].y / length) * limited;
            }

            temperature *= 0.96;
        }

        separateOverlappingNodes(nodes, centers, overlapGapX, overlapGapY);
        resolveLinkCrossings(nodes, edges, centers, baseSpacing, overlapGapX, overlapGapY, seedCenters);
        separateOverlappingNodes(nodes, centers, overlapGapX, overlapGapY);

        const positions = nodes.map((node, index) => ({
            id: node.id,
            x: centers[index].x - node.width / 2,
            y: centers[index].y - node.height / 2,
            z: node.z,
        }));

        return normalizeLayout(nodes, packDisconnectedComponents(nodes, links, positions, options), options);
    }

    function calculateLayoutResult(data: any) {
        const nodes = (data.nodes ?? []) as WorkerLayoutNode[];
        const links = (data.links ?? []) as WorkerLayoutLink[];
        const options = data.options ?? {};

        switch (data.algorithm) {
            case "sequential":
                return layoutSequential(nodes, links, options);
            case "radial":
                return layoutRadial(nodes, links, options);
            case "tree":
                return layoutTree(nodes, links, options);
            case "structural":
                return layoutHierarchical(nodes, links, options, false);
            case "organic": {
                const radialSeed = layoutRadial(nodes, links, options);
                return runForceLayout(
                    nodes,
                    links,
                    {
                        ...options,
                        iterations: Math.min(options.iterations ?? 150, 130),
                    },
                    0,
                    0.02,
                    radialSeed.positions,
                );
            }
            case "force-direction": {
                const structuralSeed = layoutHierarchical(nodes, links, options, false);
                return runForceLayout(
                    nodes,
                    links,
                    {
                        ...options,
                        iterations: Math.min(options.iterations ?? 140, 120),
                    },
                    Math.max((options.gapX ?? 140) * 0.03, 1),
                    0.018,
                    structuralSeed.positions,
                );
            }
            default:
                return runForceLayout(nodes, links, options, Math.max((options.gapX ?? 140) * 0.03, 1), 0.018);
        }
    }

    function calculateFitViewResult(data: any) {
        const nodes = (data.nodes ?? []) as WorkerLayoutNode[];
        const bounds = getLayoutBounds(nodes, nodes.map(node => ({ id: node.id, x: node.x, y: node.y, z: node.z })));
        if (nodes.length === 0 || data.viewportWidth <= 0 || data.viewportHeight <= 0) {
            return { x: 0, y: 0, zoom: 1, bounds };
        }

        const padding = Math.max(0, data.padding ?? 32);
        const safeWidth = Math.max(bounds.width, 1);
        const safeHeight = Math.max(bounds.height, 1);
        const availableWidth = Math.max(1, data.viewportWidth - padding * 2);
        const availableHeight = Math.max(1, data.viewportHeight - padding * 2);
        const zoomX = availableWidth / safeWidth;
        const zoomY = availableHeight / safeHeight;
        const unclampedZoom = Math.min(zoomX, zoomY);
        const zoom = Math.min(data.maxZoom ?? 2, Math.max(data.minZoom ?? 0.1, unclampedZoom));
        const x = bounds.left + bounds.width / 2 - data.viewportWidth / (2 * zoom);
        const y = bounds.top + bounds.height / 2 - data.viewportHeight / (2 * zoom);

        return { x, y, zoom, bounds };
    }

    // eslint-disable-next-line no-restricted-globals
    (self as any).onmessage = function (e: MessageEvent<MessageEventData>) {
        const data = e.data;
        const { id, type } = data;

        if (type === "calculatePath") {
            const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir, steps } = data;
            const curve = resolveQuadraticCurve({ fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir });
            const centerD = `M ${curve.p0x} ${curve.p0y} Q ${curve.p1x} ${curve.p1y} ${curve.p2x} ${curve.p2y}`;
            const points = sampleOffsetPoints(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, 0, steps);

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }

            post({
                type: "calculatePath", id, pathD: centerD,
                bounds: { left: minX, top: minY, width: maxX - minX, height: maxY - minY },
            });
        }
        else if (type === "calculateBidirectionalPath") {
            const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir, gap, steps } = data;
            const curve = resolveQuadraticCurve({ fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir });
            const centerD = `M ${curve.p0x} ${curve.p0y} Q ${curve.p1x} ${curve.p1y} ${curve.p2x} ${curve.p2y}`;
            const halfGap = gap / 2;
            const fwdPoints = sampleOffsetPoints(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, -halfGap, steps);
            const revPoints = sampleOffsetPoints(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, halfGap, steps);

            const padding = 50 + gap;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const pts of [fwdPoints, revPoints]) {
                for (const p of pts) {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                }
            }
            minX -= padding; minY -= padding; maxX += padding; maxY += padding;

            post({
                type: "calculateBidirectionalPath", id, centerD,
                forwardD: pointsToQuadraticPath(fwdPoints),
                reverseD: pointsToQuadraticPath(revPoints),
                bounds: { left: minX, top: minY, width: maxX - minX, height: maxY - minY },
            });
        }
        else if (type === "calculateLabels") {
            const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir, labels } = data;
            const curve = resolveQuadraticCurve({ fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir });

            const TABLE_SIZE = 200;
            const table = buildLengthTable(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, TABLE_SIZE);
            const totalLen = table[TABLE_SIZE];

            const positions = (labels as any[]).map((lbl: any) => {
                const normalizedPos = Math.max(-1, Math.min(1, lbl.position));
                const targetLen = ((normalizedPos + 1) / 2) * totalLen;
                const t = parameterAtLength(table, targetLen);
                const point = quadraticBezier(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, t);
                const norm = normalAt(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, t);

                if (lbl.side === "forward" || lbl.side === "reverse") {
                    const sign = lbl.side === "forward" ? -1 : 1;
                    const totalDisplacement = ((lbl.offset ?? 0)) * sign;
                    const x = point.x + norm.x * totalDisplacement;
                    const y = point.y + norm.y * totalDisplacement;
                    const outNx = norm.x * sign;
                    return { x, y, textAnchor: outNx < 0 ? "end" : "start" };
                }

                return { x: point.x, y: point.y, textAnchor: "middle" };
            });

            post({ type: "calculateLabels", id, positions });
        } else if (type === "calculateBidirectionalLabels") {
            const { fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir, halfGap, labels } = data;
            const curve = resolveQuadraticCurve({ fromX, fromY, toX, toY, fromVector, toVector, fromDir, toDir });

            const TABLE_SIZE = 200;
            const table = buildLengthTable(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, TABLE_SIZE);
            const totalLen = table[TABLE_SIZE];

            const positions = (labels as any[]).map((lbl: any) => {
                const normalizedPos = Math.max(-1, Math.min(1, lbl.position));
                const targetLen = ((normalizedPos + 1) / 2) * totalLen;
                const t = parameterAtLength(table, targetLen);
                const point = quadraticBezier(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, t);
                const norm = normalAt(curve.p0x, curve.p0y, curve.p1x, curve.p1y, curve.p2x, curve.p2y, t);

                if (lbl.side === "forward" || lbl.side === "reverse") {
                    const sign = lbl.side === "forward" ? -1 : 1;
                    const totalDisplacement = (halfGap + (lbl.offset ?? 0)) * sign;
                    const x = point.x + norm.x * totalDisplacement;
                    const y = point.y + norm.y * totalDisplacement;
                    const outNx = norm.x * sign;
                    return { x, y, textAnchor: outNx < 0 ? "end" : "start" };
                }

                return { x: point.x, y: point.y, textAnchor: "middle" };
            });

            post({ type: "calculateBidirectionalLabels", id, positions });
        }
        else if (type === "calculateLayout") {
            const result = calculateLayoutResult(data);
            post({ type: "calculateLayout", id, ...result });
        }
        else if (type === "calculateFitView") {
            const result = calculateFitViewResult(data);
            post({ type: "calculateFitView", id, ...result });
        }
    };
}

// Pool de workers — multithreading real via despacho round-robin
type PoolWorker = {
    worker: Worker;
    pending: Map<string, (data: any) => void>;
};

let pool: PoolWorker[] | null = null;
let roundRobin = 0;
let idCounter = 0;
let configuredSize: number | null = null;
let poolBlobUrl: string | null = null;
let providerUsers = 0;

/**
 * Configura o tamanho do pool de workers.
 * Deve ser chamado antes do primeiro cálculo para definir quantos workers
 * serão instanciados (round-robin dispatch).
 * 
 * Se não for chamado, o pool será criado automaticamente considerando a quantidade de
 * núcleos do processador (navigator.hardwareConcurrency) limitado a um máximo de 4 workers.
 *
 * @param size Número de workers desejado (será arredondado para inteiro >= 1)
 */
export function configureWorkerPool(size: number) {
    if (pool) {
        throw new Error("Worker pool ja foi inicializado. Configure antes do primeiro calculo.");
    }
    configuredSize = Math.max(1, Math.floor(size));
}

function getPool(): PoolWorker[] {
    if (!pool) {
        const size = configuredSize ?? Math.max(1, Math.min(navigator.hardwareConcurrency ?? 2, 4));
        const code = `(${workerSource.toString()})()`;
        poolBlobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));

        pool = Array.from({ length: size }, () => {
            const pending = new Map<string, (data: any) => void>();
            const worker = new Worker(poolBlobUrl!);
            worker.onmessage = (e: MessageEvent) => {
                const { id, ...rest } = e.data;
                const cb = pending.get(id);
                if (cb) {
                    cb(rest);
                    pending.delete(id);
                }
            };
            return { worker, pending };
        });
    }
    return pool;
}

export function disposeWorkerPool() {
    if (!pool) {
        return;
    }

    for (const entry of pool) {
        entry.pending.clear();
        entry.worker.terminate();
    }

    pool = null;
    roundRobin = 0;
    idCounter = 0;

    if (poolBlobUrl) {
        URL.revokeObjectURL(poolBlobUrl);
        poolBlobUrl = null;
    }
}

function request<T>(message: Record<string, unknown>): Promise<T> {
    const workers = getPool();
    const entry = workers[roundRobin % workers.length];
    roundRobin++;

    return new Promise((resolve) => {
        const id = String(++idCounter);
        entry.pending.set(id, resolve as (data: any) => void);
        entry.worker.postMessage({ ...message, id });
    });
}

/**
 * Calcula os paths SVG (forward/reverse/center) e os bounds para um link
 * entre duas portas. Esta função delega o trabalho a um worker do pool.
 *
 * @param input Dados de entrada para o cálculo do path
 * @returns Promise contendo os dados de path e bounds
 */
export function calculatePath(input: PathInput): Promise<PathOutput> {
    return request<PathOutput>({ type: "calculatePath", ...input });
}

/**
 * Calcula os paths SVG (forward/reverse/center) e os bounds para um link
 * entre duas portas. Esta função delega o trabalho a um worker do pool.
 *
 * @param input Dados de entrada para o cálculo do path
 * @returns Promise contendo os dados de path e bounds
 */
export function calculateBidirectionalPath(input: BidirectionalPathInput): Promise<BidirectionalPathOutput> {
    return request<BidirectionalPathOutput>({ type: "calculateBidirectionalPath", ...input });
}


/**
 * Calcula as posições dos rótulos (labels) ao longo do caminho entre duas
 * portas. Retorna um array de posições que devem ser aplicadas como atributos
 * de texto no DOM SVG.
 *
 * @param input Dados de entrada para cálculo de labels
 * @returns Promise com posições dos labels
 */
export function calculateBidirectionalLabels(input: BidirectionalLabelsInput): Promise<{ positions: LabelOutput[] }> {
    return request<{ positions: LabelOutput[] }>({ type: "calculateBidirectionalLabels", ...input });
}


/**
 * Calcula as posições dos rótulos (labels) ao longo do caminho entre duas
 * portas. Retorna um array de posições que devem ser aplicadas como atributos
 * de texto no DOM SVG.
 *
 * @param input Dados de entrada para cálculo de labels
 * @returns Promise com posições dos labels
 */
export function calculateLabels(input: LabelsInput): Promise<{ positions: LabelOutput[] }> {
    return request<{ positions: LabelOutput[] }>({ type: "calculateLabels", ...input });
}

/**
 * Calcula um layout completo para os nós do grafo em um worker do pool.
 *
 * @param input Dados de entrada do algoritmo de layout
 * @returns Promise com as novas posições e bounds resultantes
 */
export function calculateLayout(input: LayoutInput): Promise<LayoutOutput> {
    return request<LayoutOutput>({ type: "calculateLayout", ...input });
}

/**
 * Calcula o viewbox ideal para enquadrar todos os nós em uma viewport.
 *
 * @param input Dados de entrada para fit da viewport
 * @returns Promise com x, y e zoom calculados
 */
export function calculateFitView(input: FitViewInput): Promise<FitViewOutput> {
    return request<FitViewOutput>({ type: "calculateFitView", ...input });
}

export class WebWorkerProvider implements MathProvider {
    private active = false;

    setup(): void {
        if (this.active) {
            return;
        }

        this.active = true;
        providerUsers += 1;
    }

    calculatePath(input: PathInput): Promise<PathOutput> {
        this.setup();
        return calculatePath(input);
    }

    calculateBidirectionalPath(input: BidirectionalPathInput): Promise<BidirectionalPathOutput> {
        this.setup();
        return calculateBidirectionalPath(input);
    }

    async calculateLabels(input: LabelsInput): Promise<LabelOutput[]> {
        this.setup();
        const result = await calculateLabels(input);
        return result.positions;
    }

    async calculateBidirectionalLabels(input: BidirectionalLabelsInput): Promise<LabelOutput[]> {
        this.setup();
        const result = await calculateBidirectionalLabels(input);
        return result.positions;
    }

    calculateLayout(input: LayoutInput): Promise<LayoutOutput> {
        this.setup();
        return calculateLayout(input);
    }

    calculateFitView(input: FitViewInput): Promise<FitViewOutput> {
        this.setup();
        return calculateFitView(input);
    }

    async dispose(): Promise<void> {
        if (!this.active) {
            return;
        }

        this.active = false;
        providerUsers = Math.max(0, providerUsers - 1);

        if (providerUsers === 0) {
            disposeWorkerPool();
        }
    }
}

let defaultMathProvider: WebWorkerProvider | null = null;

export function getDefaultMathProvider(): MathProvider {
    if (!defaultMathProvider) {
        defaultMathProvider = new WebWorkerProvider();
    }

    return defaultMathProvider;
}
