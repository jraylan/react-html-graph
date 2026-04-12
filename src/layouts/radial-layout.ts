import { GraphLayoutInput, GraphLayoutResult } from "../types";
import type { MathProvider } from "../calculations/types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout radial distribuindo camadas ao redor de uma raiz.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function radialLayout(input: GraphLayoutInput, mathProvider?: MathProvider): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("radial", input, mathProvider);
}
