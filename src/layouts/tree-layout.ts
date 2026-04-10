import { GraphLayoutInput, GraphLayoutResult } from "../types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout em árvore para grafos com hierarquia predominante.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function treeLayout(input: GraphLayoutInput): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("tree", input);
}
