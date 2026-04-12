declare module "gpu.js/dist/gpu-browser.js" {
    import type { GPU as GPUType } from "gpu.js";

    const GPUBrowser: typeof GPUType;
    export default GPUBrowser;
}

declare module "gpu.js/dist/gpu-browser" {
    import type { GPU as GPUType } from "gpu.js";

    const GPUBrowser: typeof GPUType;
    export default GPUBrowser;
}
