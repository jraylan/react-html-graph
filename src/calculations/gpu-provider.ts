import { GPU, type GPUInstance } from "../vendor/gpu";
import {
    cubicBezier,
    cubicCurveToPath,
    getBoundsFromPoints,
    normalAt,
    pointsToSplinePath,
    resolveFixedTangentCurve,
    type SampledPoint,
} from "../utils/link-curve";
import { WebWorkerProvider } from "./index";
import type {
    BidirectionalLabelsInput,
    BidirectionalPathInput,
    BidirectionalPathOutput,
    FitViewInput,
    FitViewOutput,
    LabelOutput,
    LabelsInput,
    LayoutInput,
    LayoutNodeInput,
    LayoutOutput,
    MathProvider,
    PathInput,
    PathOutput,
} from "./types";

type Kernel = any;
export type GPUProviderMode = "gpu" | "webgl" | "webgl2" | "cpu";

type GPUBackendMode = Exclude<GPUProviderMode, "cpu">;
type GPUExecutionMode = GPUProviderMode;

const GPU_SAMPLE_KERNEL_SETTINGS = {
    dynamicArguments: true,
    dynamicOutput: true,
    output: [2],
    precision: "single" as const,
    tactic: "precision" as const,
    fixIntegerDivisionAccuracy: true,
    argumentTypes: ["Array", "Float", "Float", "Float", "Float", "Float", "Float", "Float", "Float"],
    returnType: "Array(4)",
};

const GPU_PATH_STEPS_THRESHOLD = 12;

function getLayoutBounds(nodes: LayoutNodeInput[]) {
    if (nodes.length === 0) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const node of nodes) {
        left = Math.min(left, node.x);
        top = Math.min(top, node.y);
        right = Math.max(right, node.x + node.width);
        bottom = Math.max(bottom, node.y + node.height);
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

export class GPUProvider implements MathProvider {
    private gpu: GPUInstance | null = null;
    private sampleKernel: Kernel | null = null;
    private workerFallbackProvider: WebWorkerProvider | null = null;
    private executionMode: GPUExecutionMode | null = null;
    private parameterCache = new Map<number, Float32Array>();
    private runtimeValidationCount = 0;

    private destroySamplingKernels() {
        this.sampleKernel?.destroy?.();
        this.sampleKernel = null;
    }

    private resetGpuInstance() {
        this.destroySamplingKernels();

        if (this.gpu) {
            this.gpu.destroy();
            this.gpu = null;
        }

        this.executionMode = null;
        this.runtimeValidationCount = 0;
    }

    private getAvailableGpuModes(): GPUBackendMode[] {
        const modes: GPUBackendMode[] = [];

        if (typeof window !== "undefined") {
            modes.push("webgl2", "webgl");
        } else if (typeof GPU.isWebGL2Supported === "boolean" || typeof GPU.isWebGLSupported === "boolean") {
            if (GPU.isWebGL2Supported) {
                modes.push("webgl2");
            }

            if (GPU.isWebGLSupported) {
                modes.push("webgl");
            }
        }

        if (!modes.includes("gpu")) {
            modes.push("gpu");
        }

        return Array.from(new Set(modes));
    }

    private activateMode(mode: GPUExecutionMode) {
        this.resetGpuInstance();

        this.executionMode = mode;
        this.gpu = new GPU({ mode });
        this.sampleKernel = (this.gpu as any).createKernel(function (
            this: { thread: { x: number } },
            ts: number[],
            p0x: number,
            p0y: number,
            p1x: number,
            p1y: number,
            p2x: number,
            p2y: number,
            p3x: number,
            p3y: number,
        ) {
            const t = ts[this.thread.x];
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

            return [x, y, tx, ty];
        }, GPU_SAMPLE_KERNEL_SETTINGS) as Kernel;

        if (mode !== "cpu") {
            const validationIssue = this.getSampleValidationIssue(
                this.executeSampleCurve(10.5, 12.25, 44.5, -18.5, 108.25, 96.75, 147.875, 64.5, 17),
                10.5,
                12.25,
                44.5,
                -18.5,
                108.25,
                96.75,
                147.875,
                64.5,
            );

            if (validationIssue) {
                throw new Error(`GPUProvider rejeitou o backend ${mode} no autoteste. ${validationIssue}`);
            }
        }
    }

    setup(preferredMode?: GPUExecutionMode): void {
        const targetMode = preferredMode ?? this.executionMode ?? this.getAvailableGpuModes()[0] ?? "cpu";
        if (this.gpu && this.executionMode === targetMode) {
            return;
        }

        const supportsSinglePrecision = typeof GPU.isSinglePrecisionSupported !== "boolean"
            ? true
            : GPU.isSinglePrecisionSupported;
        const shouldForceCpu = targetMode === "cpu"
            || typeof window === "undefined"
            || !GPU.isGPUSupported
            || !supportsSinglePrecision;

        if (targetMode !== "cpu" && !supportsSinglePrecision) {
            console.warn("GPUProvider caiu para modo CPU porque o ambiente não oferece suporte a single precision no GPU.js.");
        }

        if (shouldForceCpu) {
            this.activateMode("cpu");
            return;
        }

        const candidateModes = preferredMode && preferredMode !== "cpu"
            ? [preferredMode]
            : this.getAvailableGpuModes();
        let lastError: unknown = null;

        for (const mode of candidateModes) {
            try {
                this.activateMode(mode);
                return;
            } catch (error) {
                lastError = error;
                this.resetGpuInstance();
                console.warn(`GPUProvider rejeitou o backend ${mode} durante a inicialização.`, error);
            }
        }

        console.warn("GPUProvider caiu para modo CPU porque nenhum backend GPU validou corretamente.", lastError);
        this.activateMode("cpu");
    }

    getExecutionMode(): GPUProviderMode | null {
        return this.executionMode;
    }

    isUsingGpuBackend(): boolean {
        return this.executionMode !== null && this.executionMode !== "cpu";
    }

    private shouldUseWorkerForPathSteps(steps: number) {
        return Math.max(1, Math.floor(steps)) <= GPU_PATH_STEPS_THRESHOLD;
    }

    private ensureWorkerFallbackProvider() {
        if (!this.workerFallbackProvider) {
            this.workerFallbackProvider = new WebWorkerProvider();
        }

        return this.workerFallbackProvider;
    }

    private tryAlternativeGpuBackend(failedMode: GPUExecutionMode) {
        for (const mode of this.getAvailableGpuModes()) {
            if (mode === failedMode) {
                continue;
            }

            try {
                this.activateMode(mode);
                return true;
            } catch (error) {
                this.resetGpuInstance();
                console.warn(`GPUProvider rejeitou o backend alternativo ${mode} após falha em ${failedMode}.`, error);
            }
        }

        return false;
    }

    private buildParameterInput(size: number) {
        const cached = this.parameterCache.get(size);
        if (cached) {
            return cached;
        }

        const lastIndex = Math.max(1, size - 1);
        const parameters = new Float32Array(size);

        for (let index = 0; index < size; index++) {
            parameters[index] = index / lastIndex;
        }

        this.parameterCache.set(size, parameters);
        return parameters;
    }

    private readSampleKernel(args: number[], size: number) {
        if (!this.sampleKernel) {
            return [] as ArrayLike<ArrayLike<number>>;
        }

        const parameters = this.buildParameterInput(size);
        return this.sampleKernel.setOutput([size])(parameters, ...args) as ArrayLike<ArrayLike<number>>;
    }

    private rebuildInCpuMode(error: unknown) {
        if (!this.executionMode || this.executionMode === "cpu") {
            throw error;
        }

        const failedMode = this.executionMode;

        if (this.tryAlternativeGpuBackend(failedMode)) {
            console.warn(`GPUProvider trocou do backend ${failedMode} para ${this.executionMode} após falha em runtime.`, error);
            return;
        }

        console.warn("GPUProvider caiu para modo CPU após falha no backend GPU.", error);
        this.activateMode("cpu");
    }

    private executeSampleCurve(
        p0x: number,
        p0y: number,
        p1x: number,
        p1y: number,
        p2x: number,
        p2y: number,
        p3x: number,
        p3y: number,
        size: number,
    ): SampledPoint[] {
        const vectors = this.readSampleKernel([p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y], size);
        const samples: SampledPoint[] = [];

        for (let index = 0; index < size; index++) {
            const vector = vectors[index] as ArrayLike<number> | undefined;
            const x = Number(vector?.[0] ?? Number.NaN);
            const y = Number(vector?.[1] ?? Number.NaN);
            const tx = Number(vector?.[2] ?? 0);
            const ty = Number(vector?.[3] ?? 0);
            const magnitude = Math.hypot(tx, ty) || 1;

            samples.push({
                x,
                y,
                nx: -ty / magnitude,
                ny: tx / magnitude,
            });
        }

        return samples;
    }

    private formatNumber(value: number) {
        return Number.isFinite(value) ? value.toFixed(3) : String(value);
    }

    private formatPoint(x: number, y: number) {
        return `(${this.formatNumber(x)}, ${this.formatNumber(y)})`;
    }

    private getSampleValidationIssue(
        samples: SampledPoint[],
        p0x: number,
        p0y: number,
        p1x: number,
        p1y: number,
        p2x: number,
        p2y: number,
        p3x: number,
        p3y: number,
    ) {
        if (samples.length < 2) {
            return `quantidade insuficiente de amostras: ${samples.length}.`;
        }

        for (const [index, sample] of samples.entries()) {
            if (
                !Number.isFinite(sample.x)
                || !Number.isFinite(sample.y)
                || !Number.isFinite(sample.nx)
                || !Number.isFinite(sample.ny)
            ) {
                return `amostra ${index} contém valores inválidos: x=${sample.x}, y=${sample.y}, nx=${sample.nx}, ny=${sample.ny}.`;
            }
        }

        const first = samples[0];
        const last = samples[samples.length - 1];
        const tolerance = 1;

        if (
            Math.abs(first.x - p0x) > tolerance
            || Math.abs(first.y - p0y) > tolerance
            || Math.abs(last.x - p3x) > tolerance
            || Math.abs(last.y - p3y) > tolerance
        ) {
            return `extremos divergiram: início ${this.formatPoint(first.x, first.y)} esperado ${this.formatPoint(p0x, p0y)}; fim ${this.formatPoint(last.x, last.y)} esperado ${this.formatPoint(p3x, p3y)}.`;
        }

        const lastIndex = samples.length - 1;
        const checkpointIndexes = new Set([
            Math.floor(lastIndex / 4),
            Math.floor(lastIndex / 2),
            Math.floor((lastIndex * 3) / 4),
        ]);

        for (const index of checkpointIndexes) {
            if (index <= 0 || index >= lastIndex) {
                continue;
            }

            const sample = samples[index];
            const t = index / lastIndex;
            const expectedCurve = { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y };
            const expectedPoint = cubicBezier(expectedCurve, t);
            const expectedNormal = normalAt(expectedCurve, t);
            const positionTolerance = 2;
            const normalTolerance = 0.35;

            if (
                Math.abs(sample.x - expectedPoint.x) > positionTolerance
                || Math.abs(sample.y - expectedPoint.y) > positionTolerance
            ) {
                return `amostra ${index} divergiu do ponto esperado: recebido ${this.formatPoint(sample.x, sample.y)} esperado ${this.formatPoint(expectedPoint.x, expectedPoint.y)}.`;
            }

            if (
                Math.abs(sample.nx - expectedNormal.x) > normalTolerance
                || Math.abs(sample.ny - expectedNormal.y) > normalTolerance
            ) {
                return `amostra ${index} divergiu da normal esperada: recebido (${this.formatNumber(sample.nx)}, ${this.formatNumber(sample.ny)}) esperado (${this.formatNumber(expectedNormal.x)}, ${this.formatNumber(expectedNormal.y)}).`;
            }
        }

        return null;
    }

    private getSampleIntegrityIssue(
        samples: SampledPoint[],
        p0x: number,
        p0y: number,
        p3x: number,
        p3y: number,
    ) {
        if (samples.length < 2) {
            return `quantidade insuficiente de amostras: ${samples.length}.`;
        }

        for (const [index, sample] of samples.entries()) {
            if (
                !Number.isFinite(sample.x)
                || !Number.isFinite(sample.y)
                || !Number.isFinite(sample.nx)
                || !Number.isFinite(sample.ny)
            ) {
                return `amostra ${index} contém valores inválidos: x=${sample.x}, y=${sample.y}, nx=${sample.nx}, ny=${sample.ny}.`;
            }
        }

        const first = samples[0];
        const last = samples[samples.length - 1];
        const tolerance = 1;

        if (
            Math.abs(first.x - p0x) > tolerance
            || Math.abs(first.y - p0y) > tolerance
            || Math.abs(last.x - p3x) > tolerance
            || Math.abs(last.y - p3y) > tolerance
        ) {
            return `extremos divergiram: início ${this.formatPoint(first.x, first.y)} esperado ${this.formatPoint(p0x, p0y)}; fim ${this.formatPoint(last.x, last.y)} esperado ${this.formatPoint(p3x, p3y)}.`;
        }

        return null;
    }

    private getRuntimeSampleIssue(
        samples: SampledPoint[],
        p0x: number,
        p0y: number,
        p1x: number,
        p1y: number,
        p2x: number,
        p2y: number,
        p3x: number,
        p3y: number,
    ) {
        const integrityIssue = this.getSampleIntegrityIssue(samples, p0x, p0y, p3x, p3y);
        if (integrityIssue) {
            return integrityIssue;
        }

        if (this.executionMode === "cpu" || this.runtimeValidationCount >= 2) {
            return null;
        }

        this.runtimeValidationCount += 1;
        return this.getSampleValidationIssue(samples, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
    }

    private sampleCurve(
        p0x: number,
        p0y: number,
        p1x: number,
        p1y: number,
        p2x: number,
        p2y: number,
        p3x: number,
        p3y: number,
        steps: number,
    ): SampledPoint[] {
        const safeSteps = Math.max(1, Math.floor(steps));
        const size = safeSteps + 1;
        try {
            this.setup();
            const samples = this.executeSampleCurve(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, size);
            const validationIssue = this.getRuntimeSampleIssue(samples, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
            if (validationIssue) {
                throw new Error(`GPUProvider gerou amostras inválidas para a curva. ${validationIssue}`);
            }

            return samples;
        } catch (error) {
            this.rebuildInCpuMode(error);
            const samples = this.executeSampleCurve(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, size);
            const validationIssue = this.getSampleIntegrityIssue(samples, p0x, p0y, p3x, p3y);
            if (validationIssue) {
                throw new Error(`GPUProvider gerou amostras inválidas mesmo após fallback para CPU. ${validationIssue}`);
            }

            return samples;
        }
    }

    async calculatePath(input: PathInput): Promise<PathOutput> {
        if (this.shouldUseWorkerForPathSteps(input.steps)) {
            return this.ensureWorkerFallbackProvider().calculatePath(input);
        }

        const curve = resolveFixedTangentCurve(input);
        const samples = this.sampleCurve(
            curve.p0x,
            curve.p0y,
            curve.p1x,
            curve.p1y,
            curve.p2x,
            curve.p2y,
            curve.p3x,
            curve.p3y,
            input.steps,
        );
        const bounds = getBoundsFromPoints(samples);

        return {
            pathD: cubicCurveToPath(curve),
            bounds,
        };
    }

    async calculateBidirectionalPath(input: BidirectionalPathInput): Promise<BidirectionalPathOutput> {
        if (this.shouldUseWorkerForPathSteps(input.steps)) {
            return this.ensureWorkerFallbackProvider().calculateBidirectionalPath(input);
        }

        const curve = resolveFixedTangentCurve(input);
        const samples = this.sampleCurve(
            curve.p0x,
            curve.p0y,
            curve.p1x,
            curve.p1y,
            curve.p2x,
            curve.p2y,
            curve.p3x,
            curve.p3y,
            input.steps,
        );
        const halfGap = input.gap / 2;
        const forwardPoints = samples.map(point => ({
            x: point.x - point.nx * halfGap,
            y: point.y - point.ny * halfGap,
        }));
        const reversePoints = samples.map(point => ({
            x: point.x + point.nx * halfGap,
            y: point.y + point.ny * halfGap,
        }));
        const bounds = getBoundsFromPoints([...forwardPoints, ...reversePoints]);
        const padding = 50 + input.gap;

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

    async calculateLabels(input: LabelsInput): Promise<LabelOutput[]> {
        return this.ensureWorkerFallbackProvider().calculateLabels(input);
    }

    async calculateBidirectionalLabels(input: BidirectionalLabelsInput): Promise<LabelOutput[]> {
        return this.ensureWorkerFallbackProvider().calculateBidirectionalLabels(input);
    }

    calculateLayout(input: LayoutInput): Promise<LayoutOutput> {
        return this.ensureWorkerFallbackProvider().calculateLayout(input);
    }

    async calculateFitView(input: FitViewInput): Promise<FitViewOutput> {
        const bounds = getLayoutBounds(input.nodes);
        if (input.nodes.length === 0 || input.viewportWidth <= 0 || input.viewportHeight <= 0) {
            return { x: 0, y: 0, zoom: 1, bounds };
        }

        const padding = Math.max(0, input.padding ?? 32);
        const safeWidth = Math.max(bounds.width, 1);
        const safeHeight = Math.max(bounds.height, 1);
        const availableWidth = Math.max(1, input.viewportWidth - padding * 2);
        const availableHeight = Math.max(1, input.viewportHeight - padding * 2);
        const zoomX = availableWidth / safeWidth;
        const zoomY = availableHeight / safeHeight;
        const unclampedZoom = Math.min(zoomX, zoomY);
        const zoom = Math.min(input.maxZoom ?? 2, Math.max(input.minZoom ?? 0.1, unclampedZoom));
        const x = bounds.left + bounds.width / 2 - input.viewportWidth / (2 * zoom);
        const y = bounds.top + bounds.height / 2 - input.viewportHeight / (2 * zoom);

        return { x, y, zoom, bounds };
    }

    async dispose(): Promise<void> {
        this.resetGpuInstance();

        if (this.workerFallbackProvider) {
            await Promise.resolve(this.workerFallbackProvider.dispose());
            this.workerFallbackProvider = null;
        }
    }
}
