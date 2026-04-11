import { createContext } from "react";
import { LinkInfoContextValue } from "../types";

/** Contexto que expõe informações do link para componentes filhos. */
export const LinkInfoContext = createContext<LinkInfoContextValue>({
    id: "",
    from: { node: "", port: "" },
    to: { node: "", port: "" },
    fromNode: null,
    fromPort: null,
    toNode: null,
    toPort: null,
    fromNodeState: null,
    data: {},
    toNodeState: null,
});
