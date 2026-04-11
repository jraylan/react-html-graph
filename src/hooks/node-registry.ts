import { useContext } from "react";
import { NodeRegistryContext } from "../context/node-registry-context";

/** Hook que retorna o registro centralizado de nós e portas. */
export default function useNodeRegistry() {
    return useContext(NodeRegistryContext);
}
