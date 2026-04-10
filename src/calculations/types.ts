export type PortDirection = "left" | "right" | "top" | "bottom";

export type PathInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromDir: PortDirection;
    toDir: PortDirection;
    gap: number;
    steps: number;
};

export type PathOutput = {
    centerD: string;
    forwardD: string;
    reverseD: string;
    bounds: { left: number; top: number; width: number; height: number };
};

export type LayoutAlgorithm =
    | "force-direction"
    | "organic"
    | "radial"
    | "sequential"
    | "structural"
    | "tree";

export type LayoutNodeInput = {
    id: string;
    width: number;
    height: number;
    x: number;
    y: number;
    z: number;
};

export type LayoutLinkInput = {
    id: string;
    from: string;
    to: string;
};

export type LayoutOptions = {
    viewport?: { width: number; height: number };
    gapX?: number;
    gapY?: number;
    padding?: number;
    columns?: number;
    direction?: "LR" | "RL" | "TB" | "BT";
    iterations?: number;
    radiusStep?: number;
    center?: { x: number; y: number };
};

export type LayoutInput = {
    algorithm: LayoutAlgorithm;
    nodes: LayoutNodeInput[];
    links: LayoutLinkInput[];
    options?: LayoutOptions;
};

export type LayoutOutput = {
    positions: Array<{
        id: string;
        x: number;
        y: number;
        z: number;
    }>;
    bounds: { left: number; top: number; width: number; height: number };
};

export type FitViewInput = {
    nodes: LayoutNodeInput[];
    viewportWidth: number;
    viewportHeight: number;
    padding: number;
    minZoom: number;
    maxZoom: number;
};

export type FitViewOutput = {
    x: number;
    y: number;
    zoom: number;
    bounds: { left: number; top: number; width: number; height: number };
};

export type LabelInput = {
    position: number;
    side: string;
    offset: number;
};

export type LabelsInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromDir: PortDirection;
    toDir: PortDirection;
    halfGap: number;
    labels: LabelInput[];
};

export type LabelOutput = {
    x: number;
    y: number;
    textAnchor: string;
};
