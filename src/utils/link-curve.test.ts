import {
    pointsToSplinePath,
    resolveFixedTangentCurve,
    sampleOffsetPoints,
} from "./link-curve";

describe("link-curve", () => {
    it("aumenta o handle quando a tangente faz um ângulo mais agressivo", () => {
        const straight = resolveFixedTangentCurve({
            fromX: 0,
            fromY: 0,
            toX: 120,
            toY: 0,
            fromVector: { x: 1, y: 0 },
            toVector: { x: -1, y: 0 },
        });
        const bent = resolveFixedTangentCurve({
            fromX: 0,
            fromY: 0,
            toX: 120,
            toY: 0,
            fromVector: { x: 0, y: -1 },
            toVector: { x: 0, y: 1 },
        });

        const straightStartHandle = Math.hypot(straight.p1x - straight.p0x, straight.p1y - straight.p0y);
        const bentStartHandle = Math.hypot(bent.p1x - bent.p0x, bent.p1y - bent.p0y);

        expect(bentStartHandle).toBeGreaterThan(straightStartHandle);
    });

    it("gera uma spline cúbica contínua para vários pontos", () => {
        const path = pointsToSplinePath([
            { x: 0, y: 0 },
            { x: 30, y: 20 },
            { x: 60, y: 20 },
            { x: 90, y: 0 },
        ]);

        expect(path.startsWith("M 0 0 C ")).toBe(true);
        expect(path.match(/ C /g)).toHaveLength(3);
        expect(path.trim().endsWith("90 0")).toBe(true);
    });

    it("mantém as amostras com offset zero presas nas extremidades da curva", () => {
        const curve = resolveFixedTangentCurve({
            fromX: 10,
            fromY: 15,
            toX: 140,
            toY: 60,
            fromVector: { x: 1, y: 0 },
            toVector: { x: -1, y: 0 },
        });
        const samples = sampleOffsetPoints(curve, 0, 8);

        expect(samples[0].x).toBeCloseTo(10);
        expect(samples[0].y).toBeCloseTo(15);
        expect(samples[samples.length - 1].x).toBeCloseTo(140);
        expect(samples[samples.length - 1].y).toBeCloseTo(60);
    });
});
