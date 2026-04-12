import { memo, useEffect, useMemo } from "react";
import { LinkInfoContext } from "../context/link-info-context";
import { GraphLinkRuntimeState, LinkInfoContextValue } from "../types";
import useNodeRegistry from "../hooks/node-registry";
import useLinkAnchors from "../hooks/link-anchors";
import { vectorToRuntimeDirection } from "../utils/link-geometry";

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
    const {
        fromAnchor,
        toAnchor,
        fromNodeState,
        toNodeState,
        invalid,
        getFromAnchor,
        getToAnchor,
        getFromNodeState,
        getToNodeState,
        subscribePositionChanges,
    } = useLinkAnchors({
        id,
        from,
        to,
        reportOrphans: true,
    });

    useEffect(() => {
        if (!onStateChange) return;

        const state: GraphLinkRuntimeState = {
            id,
            from: {
                nodeId: from.node,
                portId: from.port,
                x: fromAnchor?.x ?? 0,
                y: fromAnchor?.y ?? 0,
                direction: vectorToRuntimeDirection(fromAnchor?.d ?? { x: 1, y: 0 }),
            },
            to: {
                nodeId: to.node,
                portId: to.port,
                x: toAnchor?.x ?? 0,
                y: toAnchor?.y ?? 0,
                direction: vectorToRuntimeDirection(toAnchor?.d ?? { x: -1, y: 0 }),
            },
            bounds: { left: 0, top: 0, width: 0, height: 0 },
            invalid,
        };

        onStateChange(state);
    }, [from.node, from.port, fromAnchor, id, invalid, onStateChange, to.node, to.port, toAnchor]);

    // Valor do contexto com getters para evitar re-renders ao mover nós.
    // Os getters consultam o registry que usa refs internas,
    // garantindo acesso ao elemento DOM mais recente sem mudar a identidade do contexto.
    const value = useMemo<LinkInfoContextValue>(() => ({
        id,
        from,
        to,
        data,
        fromAnchor,
        toAnchor,
        getFromAnchor,
        getToAnchor,
        get fromNode() { return registry.getNodeElement(from.node); },
        get fromPort() { return registry.getPortElement(from.node, from.port); },
        get toNode() { return registry.getNodeElement(to.node); },
        get toPort() { return registry.getPortElement(to.node, to.port); },
        fromNodeState,
        toNodeState,
        getFromNodeState,
        getToNodeState,
        subscribePositionChanges,
        onStateChange,
    }), [
        data,
        from,
        fromAnchor,
        fromNodeState,
        getFromAnchor,
        getFromNodeState,
        getToAnchor,
        getToNodeState,
        id,
        onStateChange,
        registry,
        subscribePositionChanges,
        to,
        toAnchor,
        toNodeState,
    ]);

    return (
        <LinkInfoContext.Provider value={value}>
            {children}
        </LinkInfoContext.Provider>
    );
});

export default LinkInfoProvider;
