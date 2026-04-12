import type { Vector2 } from "../types";

export type PortDirection = "left" | "right" | "top" | "bottom";

export type PathInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromVector?: Vector2;
    toVector?: Vector2;
    fromDir?: PortDirection;
    toDir?: PortDirection;
    steps: number;
};

export type PathOutput = {
    pathD: string;
    bounds: { left: number; top: number; width: number; height: number };
};

export type BidirectionalPathInput = PathInput & {
    gap: number;
};

export type BidirectionalPathOutput = {
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
    offset: number;
};


export type BidirectionalLabelInput = LabelInput & {
    side: string;
};

export type LabelsInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromVector?: Vector2;
    toVector?: Vector2;
    fromDir?: PortDirection;
    toDir?: PortDirection;
    labels: LabelInput[];
};

export type BidirectionalLabelsInput = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromVector?: Vector2;
    toVector?: Vector2;
    fromDir?: PortDirection;
    toDir?: PortDirection;
    halfGap: number;
    labels: BidirectionalLabelInput[];
};

export type LabelOutput = {
    x: number;
    y: number;
    textAnchor: string;
};

type EventPayload<T extends string, D> = {
    type: T;
    id: string;
} & D;

export type MessageEventData =
    | EventPayload<"calculatePath", PathInput>
    | EventPayload<"calculateBidirectionalPath", BidirectionalPathInput>
    | EventPayload<"calculateLabels", LabelsInput>
    | EventPayload<"calculateBidirectionalLabels", BidirectionalLabelsInput>
    | EventPayload<"calculateLayout", LayoutInput>
    | EventPayload<"calculateFitView", FitViewInput>
    ;



export interface MathProvider {
    setup(): void | Promise<void>;
    calculatePath(input: PathInput): Promise<PathOutput>;
    calculateBidirectionalPath(input: BidirectionalPathInput): Promise<BidirectionalPathOutput>;
    calculateLabels(input: LabelsInput): Promise<LabelOutput[]>;
    calculateBidirectionalLabels(input: BidirectionalLabelsInput): Promise<LabelOutput[]>;
    calculateLayout(input: LayoutInput): Promise<LayoutOutput>;
    calculateFitView(input: FitViewInput): Promise<FitViewOutput>;
    dispose(): void | Promise<void>;
}

// Compatibilidade retroativa com a grafia anterior.
export type MathPrivider = MathProvider;