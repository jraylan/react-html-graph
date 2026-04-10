import { GraphLayoutAlgorithm, GraphLayoutInput, GraphLayoutResult } from "../types";
import forceDirectionLayout from "./force-direction-layout";
import organicLayout from "./organic-layout";
import radialLayout from "./radial-layout";
import sequentialLayout from "./sequential-layout";
import structuralLayout from "./structural-layout";
import treeLayout from "./tree-layout";


/** Assinatura compartilhada por todos os executores de layout. */
export type GraphLayoutExecutor = (input: GraphLayoutInput) => Promise<GraphLayoutResult>;

/** Mapa estável dos algoritmos de layout disponíveis. */
export const GRAPH_LAYOUT_EXECUTORS: Record<GraphLayoutAlgorithm, GraphLayoutExecutor> = {
    "force-direction": forceDirectionLayout,
    organic: organicLayout,
    radial: radialLayout,
    sequential: sequentialLayout,
    structural: structuralLayout,
    tree: treeLayout,
};

export { forceDirectionLayout, organicLayout, radialLayout, sequentialLayout, structuralLayout, treeLayout };