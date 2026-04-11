import { createContext } from "react";
import { GraphEventBusContextValue } from "../types";

/** Contexto do bus centralizado de eventos do grafo. */
export const GraphEventBusContext = createContext<GraphEventBusContextValue>({
    subscribe: () => { },
    unsubscribe: () => { },
    emit: () => { },
});
