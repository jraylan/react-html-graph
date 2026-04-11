import { calculateLayout } from "../calculations";
import { GraphLayoutBuiltinAlgorithm, GraphLayoutInput, GraphLayoutResult } from "../types";


/**
 * Executa um algoritmo de layout no worker pool a partir do snapshot público.
 *
 * @param algorithm Nome do algoritmo desejado
 * @param input Snapshot de nós/links e opções compartilhadas
 * @returns Resultado com posições e bounds calculados
 */
export async function runLayoutAlgorithm(
    algorithm: GraphLayoutBuiltinAlgorithm,
    input: GraphLayoutInput,
): Promise<GraphLayoutResult> {
    const result = await calculateLayout({
        algorithm,
        nodes: input.nodes.map(node => ({
            id: node.id,
            width: node.width,
            height: node.height,
            x: node.position.x,
            y: node.position.y,
            z: node.position.z,
        })),
        links: input.links.map(link => ({
            id: link.id,
            from: link.from,
            to: link.to,
        })),
        options: input.options,
    });

    return {
        positions: result.positions.map(position => ({
            id: position.id,
            position: {
                x: position.x,
                y: position.y,
                z: position.z,
            },
        })),
        bounds: result.bounds,
    };
}