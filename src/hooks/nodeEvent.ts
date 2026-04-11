import { useContext } from "react"
import { NodeEventContext } from "../context/node-event-context"
import { NoProviderSymbol } from "../utils/symbols"



/**
 * Hook que retorna o estado do viewbox (posição e zoom) do GraphContext.
 *
 * @returns Viewbox
 */
export default function useNodeEvent() {
    const nodeEvent = useContext(NodeEventContext)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((nodeEvent as any)[NoProviderSymbol]) {
        throw new Error(
            "It's not possible to use useNodeEvent outside of a NodeEventProvider..."
        )
    }

    return nodeEvent
}