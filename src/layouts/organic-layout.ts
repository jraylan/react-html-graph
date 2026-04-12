import { GraphLayoutInput, GraphLayoutResult } from "../types";
import type { MathProvider } from "../calculations/types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout orgânico baseado em relaxamento por forças.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function organicLayout(input: GraphLayoutInput, mathProvider?: MathProvider): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("organic", input, mathProvider);
}
