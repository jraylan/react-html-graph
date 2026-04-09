import { useContext } from "react"
import { GraphContext } from "../context/graph-context"



/**
 * Hook que retorna o estado do viewbox (posição e zoom) do GraphContext.
 *
 * @returns Viewbox
 */
export default function useViewbox() {
    const { viewbox } = useContext(GraphContext)
    return viewbox
}