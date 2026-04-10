import { GraphLayoutInput, GraphLayoutResult } from "../types";
import { runLayoutAlgorithm } from "./shared";


/**
 * Executa um layout orgânico baseado em relaxamento por forças.
 *
 * @param input Snapshot do grafo e opções compartilhadas
 * @returns Resultado com novas posições para os nós
 */
export default async function organicLayout(input: GraphLayoutInput): Promise<GraphLayoutResult> {
    return runLayoutAlgorithm("organic", input);
}
