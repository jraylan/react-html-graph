import { memo, useMemo } from "react";
import { LinkInfoContext } from "../context/link-info-context";
import { GraphLinkRuntimeState, LinkInfoContextValue } from "../types";
import useNodeRegistry from "../hooks/node-registry";

interface LinkInfoProviderProps<T = any> {
    id: string;
    from: { node: string; port: string };
    to: { node: string; port: string };
    data?: T;
    onStateChange?: (state: GraphLinkRuntimeState) => void;
    children: React.ReactNode;
}

/**
 * Provider que consulta o NodeRegistry centralizado para obter
 * os elementos DOM e estados dos nós/portas conectados ao link.
 * Expõe essas informações via LinkInfoContext.
 */
const LinkInfoProvider = memo(function LinkInfoProvider({
    id,
    from,
    to,
    data,
    onStateChange,
    children,
}: LinkInfoProviderProps) {
    const registry = useNodeRegistry();

    // Valor do contexto com getters para evitar re-renders ao mover nós.
    // Os getters consultam o registry que usa refs internas,
    // garantindo acesso ao elemento DOM mais recente sem mudar a identidade do contexto.
    const value = useMemo<LinkInfoContextValue>(() => ({
        id,
        from,
        to,
        data,
        get fromNode() { return registry.getNodeElement(from.node); },
        get fromPort() { return registry.getPortElement(from.node, from.port); },
        get toNode() { return registry.getNodeElement(to.node); },
        get toPort() { return registry.getPortElement(to.node, to.port); },
        get fromNodeState() { return registry.getNodeState(from.node); },
        get toNodeState() { return registry.getNodeState(to.node); },
        onStateChange,
    }), [id, from, to, data, onStateChange, registry]);

    return (
        <LinkInfoContext.Provider value={value}>
            {children}
        </LinkInfoContext.Provider>
    );
});

export default LinkInfoProvider;
