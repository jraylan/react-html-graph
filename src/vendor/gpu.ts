export type GPUInstance = {
    createKernel: (...args: unknown[]) => unknown;
    destroy: () => void | Promise<void>;
};

type GPUConstructor = {
    new(settings?: { mode?: string }): GPUInstance;
    isGPUSupported: boolean;
    isWebGLSupported: boolean;
    isWebGL2Supported: boolean;
    isSinglePrecisionSupported: boolean;
};

// @ts-ignore O subpath browser do gpu.js não publica typings próprias.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GPUBrowser = require("gpu.js/dist/gpu-browser.js") as GPUConstructor;

/**
 * Wrapper local para o bundle browser-only do gpu.js.
 *
 * O arquivo `dist/gpu-browser.js` exporta o construtor direto em CommonJS/UMD,
 * então normalizamos aqui para um named export estável (`GPU`).
 */
export const GPU = GPUBrowser;
