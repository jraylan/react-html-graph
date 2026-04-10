import { GraphLayoutInput, GraphLayoutResult } from "../types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout sequencial em linhas/colunas a partir da ordem do grafo.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function sequentialLayout(input: GraphLayoutInput): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("sequential", input);
}
