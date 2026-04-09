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
