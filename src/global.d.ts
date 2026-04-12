import * as React from 'react';

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'node-graph-object': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
                'node-id'?: string
            };
            'graph-root': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                ref?: React.Ref<HTMLElement>
            };
            'graph-viewbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                ref?: React.Ref<HTMLElement>
            };
            'node-graph-link': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
            };
            'node-graph-temp-link': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
            };
            'node-graph-port': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
                'node-port'?: string
                'port-location'?: string
                'port-id'?: string
            };
        }
    }
}

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            'node-graph-object': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
                'node-id': string
            };
            'graph-root': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                ref?: React.Ref<HTMLElement>
            };
            'graph-viewbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                ref?: React.Ref<HTMLElement>
            };
            'node-graph-link': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
            };
            'node-graph-temp-link': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
            };
            'node-graph-port': React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
                ref?: React.Ref<HTMLDivElement>
                'node-port': string
                'port-location'?: string
                'port-id': string
            };
        }
    }
}

declare module 'gpu.js/dist/gpu-browser.js' {
    import type { GPU as GPUType } from 'gpu.js';

    const GPUBrowser: typeof GPUType;
    export default GPUBrowser;
}

declare module 'gpu.js/dist/gpu-browser' {
    import type { GPU as GPUType } from 'gpu.js';

    const GPUBrowser: typeof GPUType;
    export default GPUBrowser;
}