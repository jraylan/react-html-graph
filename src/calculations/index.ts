import { PathInput, PathOutput, LabelsInput, LabelOutput } from './types';

// Fonte do worker — definida como função para que o TypeScript verifique os
// tipos do seu corpo.
// Em tempo de execução, Function.toString() retorna o JS compilado (sem tipos TS).
// Envolvemos em uma IIFE e carregamos em um Blob Worker.
function workerSource() {
    function cubicBezier(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ) {
        const t1 = 1 - t;
        return {
            x: t1 * t1 * t1 * p0x + 3 * t1 * t1 * t * p1x + 3 * t1 * t * t * p2x + t * t * t * p3x,
            y: t1 * t1 * t1 * p0y + 3 * t1 * t1 * t * p1y + 3 * t1 * t * t * p2y + t * t * t * p3y,
        };
    }

    function cubicBezierTangent(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ) {
        const t1 = 1 - t;
        return {
            x: 3 * t1 * t1 * (p1x - p0x) + 6 * t1 * t * (p2x - p1x) + 3 * t * t * (p3x - p2x),
            y: 3 * t1 * t1 * (p1y - p0y) + 6 * t1 * t * (p2y - p1y) + 3 * t * t * (p3y - p2y),
        };
    }

    function normalAt(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ) {
        const tang = cubicBezierTangent(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
        const mag = Math.sqrt(tang.x * tang.x + tang.y * tang.y) || 1;
        return { x: -tang.y / mag, y: tang.x / mag };
    }

    function buildLengthTable(
        p0x: number, p0y: number, p1x: number, p1y: number,
        p2x: number, p2y: number, p3x: number, p3y: number, n: number
    ) {
        const table = new Float64Array(n + 1);
        table[0] = 0;
        let prevX = p0x, prevY = p0y;
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            const pt = cubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
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
        p2x: number, p2y: number, p3x: number, p3y: number,
        offset: number, steps: number
    ) {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = cubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
            const n = normalAt(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
            points.push({ x: pt.x + n.x * offset, y: pt.y + n.y * offset });
        }
        return points;
    }

    function pointsToSmoothPath(points: { x: number; y: number }[]) {
        if (points.length < 2) return "";
        let d = "M " + points[0].x + " " + points[0].y;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            d += " C " + cp1x + " " + cp1y + " " + cp2x + " " + cp2y + " " + p2.x + " " + p2.y;
        }
        return d;
    }

    // eslint-disable-next-line no-restricted-globals
    const post = (self as any).postMessage.bind(self);

    // Calcula control point baseado na direcao da porta
    function controlPoint(
        x: number, y: number, dir: string, dist: number
    ): { x: number; y: number } {
        switch (dir) {
            case "right": return { x: x + dist, y };
            case "left": return { x: x - dist, y };
            case "bottom": return { x, y: y + dist };
            case "top": return { x, y: y - dist };
            default: return { x: x + dist, y };
        }
    }

    // eslint-disable-next-line no-restricted-globals
    (self as any).onmessage = function (e: MessageEvent) {
        const { type, id, ...data } = e.data;

        if (type === "calculatePath") {
            const { fromX, fromY, toX, toY, fromDir, toDir, gap, steps } = data;
            const dx = toX - fromX;
            const dy = toY - fromY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const cpDist = Math.max(50, dist * 0.4);

            const cp1 = controlPoint(fromX, fromY, fromDir, cpDist);
            const cp2 = controlPoint(toX, toY, toDir, cpDist);
            const p0x = fromX, p0y = fromY;
            const p1x = cp1.x, p1y = cp1.y;
            const p2x = cp2.x, p2y = cp2.y;
            const p3x = toX, p3y = toY;

            const centerD = `M ${p0x} ${p0y} C ${p1x} ${p1y} ${p2x} ${p2y} ${p3x} ${p3y}`;
            const halfGap = gap / 2;
            const fwdPoints = sampleOffsetPoints(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, -halfGap, steps);
            const revPoints = sampleOffsetPoints(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, halfGap, steps);

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
                type: "calculatePath", id, centerD,
                forwardD: pointsToSmoothPath(fwdPoints),
                reverseD: pointsToSmoothPath(revPoints),
                bounds: { left: minX, top: minY, width: maxX - minX, height: maxY - minY },
            });
        }
        else if (type === "calculateLabels") {
            const { fromX, fromY, toX, toY, fromDir, toDir, halfGap, labels } = data;
            const dx = toX - fromX;
            const dy = toY - fromY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const cpDist = Math.max(50, dist * 0.4);

            const cp1 = controlPoint(fromX, fromY, fromDir, cpDist);
            const cp2 = controlPoint(toX, toY, toDir, cpDist);
            const p0x = fromX, p0y = fromY;
            const p1x = cp1.x, p1y = cp1.y;
            const p2x = cp2.x, p2y = cp2.y;
            const p3x = toX, p3y = toY;

            const TABLE_SIZE = 200;
            const table = buildLengthTable(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, TABLE_SIZE);
            const totalLen = table[TABLE_SIZE];

            const positions = (labels as any[]).map((lbl: any) => {
                const normalizedPos = Math.max(-1, Math.min(1, lbl.position));
                const targetLen = ((normalizedPos + 1) / 2) * totalLen;
                const t = parameterAtLength(table, targetLen);
                const point = cubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
                const norm = normalAt(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);

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

            post({ type: "calculateLabels", id, positions });
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
        const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));

        pool = Array.from({ length: size }, () => {
            const pending = new Map<string, (data: any) => void>();
            const worker = new Worker(blobUrl);
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
