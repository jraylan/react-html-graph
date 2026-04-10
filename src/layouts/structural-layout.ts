import { GraphLayoutInput, GraphLayoutResult } from "../types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout estrutural hierárquico com base na conectividade.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function structuralLayout(input: GraphLayoutInput): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("structural", input);
}
