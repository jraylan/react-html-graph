import { createContext } from "react";
import { NodeRegistryContextValue } from "../types";

/** Contexto de registro centralizado de nós e portas. */
export const NodeRegistryContext = createContext<NodeRegistryContextValue>({
    getNodeElement: () => null,
    getPortElement: () => null,
    getNodeState: () => null,
    registerNodeElement: () => { },
    unregisterNodeElement: () => { },
    registerPortElement: () => { },
    unregisterPortElement: () => { },
    updateNodeState: () => { },
});
