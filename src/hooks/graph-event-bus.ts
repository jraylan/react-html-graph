import { useContext } from "react";
import { GraphEventBusContext } from "../context/graph-event-bus-context";

/** Hook que retorna o bus centralizado de eventos do grafo. */
export default function useGraphEventBus() {
    return useContext(GraphEventBusContext);
}
