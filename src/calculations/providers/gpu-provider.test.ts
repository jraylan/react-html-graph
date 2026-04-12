import { GPUProvider } from "./gpu-provider";

const mockGpuDestroy = jest.fn();
const mockCreateKernel = jest.fn();
const mockFailingModes = new Set<string>();
const mockInvalidModes = new Set<string>();

jest.mock("../../vendor/gpu", () => {
    class MockGPU {
        static isGPUSupported = true;
        static isSinglePrecisionSupported = true;
        static isWebGLSupported = true;
        static isWebGL2Supported = true;
        private mode: "gpu" | "cpu" | "webgl" | "webgl2";

        constructor(options?: { mode?: "cpu" | "gpu" | "webgl" | "webgl2" }) {
            this.mode = options?.mode ?? "gpu";
        }

        createKernel(_source?: unknown, settings?: unknown) {
            mockCreateKernel(this.mode, settings);

            const runner: any = (..._args: unknown[]) => {
                if (mockFailingModes.has(this.mode)) {
                    throw new Error(`backend failure: ${this.mode}`);
                }

                const output = runner.__output ?? [0];
                const parameters = _args[0] as unknown as ArrayLike<number>;
                const [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y] = _args.slice(1).map(value => Number(value ?? 0));

                return Array.from({ length: output[0] ?? 0 }, (_value, index) => {
                    if (mockInvalidModes.has(this.mode)) {
                        return new Float32Array([Number.NaN, Number.NaN, Number.NaN, Number.NaN]);
                    }

                    const t = Number(parameters[index] ?? 0);
                    const t1 = 1 - t;
                    const x = t1 * t1 * t1 * p0x
                        + 3 * t1 * t1 * t * p1x
                        + 3 * t1 * t * t * p2x
                        + t * t * t * p3x;
                    const y = t1 * t1 * t1 * p0y
                        + 3 * t1 * t1 * t * p1y
                        + 3 * t1 * t * t * p2y
                        + t * t * t * p3y;
                    const tx = 3 * t1 * t1 * (p1x - p0x)
                        + 6 * t1 * t * (p2x - p1x)
                        + 3 * t * t * (p3x - p2x);
                    const ty = 3 * t1 * t1 * (p1y - p0y)
                        + 6 * t1 * t * (p2y - p1y)
                        + 3 * t * t * (p3y - p2y);

                    return new Float32Array([x, y, tx, ty]);
                });
            };

            runner.setOutput = (output: number[]) => {
                runner.__output = output;
                return runner;
            };
            runner.destroy = jest.fn();

            return runner;
        }

        destroy() {
            mockGpuDestroy();
        }
    }

    return { GPU: MockGPU };
});

describe("GPUProvider", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFailingModes.clear();
        mockInvalidModes.clear();
    });

    it("tenta outro backend GPU antes de cair para CPU", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
        mockInvalidModes.add("webgl2");
        const provider = new GPUProvider();

        const result = await provider.calculateBidirectionalPath({
            fromX: 0,
            fromY: 0,
            toX: 100,
            toY: 40,
            gap: 8,
            steps: 16,
        });

        expect(result.centerD).toContain("M 0 0 C");
        expect(provider.getExecutionMode()).toBe("webgl");
        expect(mockCreateKernel).toHaveBeenCalledWith("webgl2", expect.objectContaining({
            precision: "single",
            tactic: "precision",
            dynamicArguments: true,
            dynamicOutput: true,
            returnType: "Array(4)",
            argumentTypes: ["Array", "Float", "Float", "Float", "Float", "Float", "Float", "Float", "Float"],
        }));
        expect(mockCreateKernel).toHaveBeenCalledWith("webgl", expect.objectContaining({
            precision: "single",
            tactic: "precision",
            dynamicArguments: true,
            dynamicOutput: true,
            returnType: "Array(4)",
            argumentTypes: ["Array", "Float", "Float", "Float", "Float", "Float", "Float", "Float", "Float"],
        }));
        expect(mockCreateKernel.mock.calls.some(([mode]) => mode === "cpu")).toBe(false);

        warnSpy.mockRestore();
    });

    it("faz fallback para CPU quando todos os backends GPU falham", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
        mockInvalidModes.add("webgl2");
        mockInvalidModes.add("webgl");
        mockInvalidModes.add("gpu");
        const provider = new GPUProvider();

        const result = await provider.calculateBidirectionalPath({
            fromX: 0,
            fromY: 0,
            toX: 100,
            toY: 40,
            gap: 8,
            steps: 16,
        });

        expect(result.centerD).toContain("M 0 0 C");
        expect(provider.getExecutionMode()).toBe("cpu");
        expect(mockCreateKernel.mock.calls.some(([mode]) => mode === "cpu")).toBe(true);

        warnSpy.mockRestore();
    });
});
