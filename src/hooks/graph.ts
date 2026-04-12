import { useContext } from "react"
import { GraphContext } from "../context/graph-context"



/**
 * Hook que fornece os itens do grafo (nós e links) a partir do GraphContext.
 *
 * @returns {{ nodes: React.ReactNode[], links: React.ReactNode[] }}
 */
export default function useGraphItems() {
    const { nodes, links, tempLinkTemplate } = useContext(GraphContext)
    return { nodes, links, tempLinkTemplate }
}