import { useCallback, useRef, useMemo } from "react";
import { NodeRegistryContext } from "../context/node-registry-context";
import { GraphNodeRuntimeState, NodeRegistryContextValue } from "../types";

interface NodeRegistryProviderProps {
    children: React.ReactNode;
}

/**
 * Provider que mantém o registro centralizado de elementos DOM
 * e estados runtime de todos os nós/portas ativos no grafo.
 * Substituí o uso de querySelector para localizar elementos.
 */
export default function NodeRegistryProvider({ children }: NodeRegistryProviderProps) {
    const nodeElements = useRef<Map<string, HTMLElement>>(new Map());
    const portElements = useRef<Map<string, HTMLElement>>(new Map());
    const nodeStates = useRef<Map<string, GraphNodeRuntimeState>>(new Map());

    const registerNodeElement = useCallback((nodeId: string, element: HTMLElement) => {
        nodeElements.current.set(nodeId, element);
    }, []);

    const unregisterNodeElement = useCallback((nodeId: string) => {
        nodeElements.current.delete(nodeId);
    }, []);

    const registerPortElement = useCallback((nodeId: string, portId: string, element: HTMLElement) => {
        portElements.current.set(`${nodeId}:${portId}`, element);
    }, []);

    const unregisterPortElement = useCallback((nodeId: string, portId: string) => {
        portElements.current.delete(`${nodeId}:${portId}`);
    }, []);

    const getNodeElement = useCallback((nodeId: string) => {
        return nodeElements.current.get(nodeId) ?? null;
    }, []);

    const getPortElement = useCallback((nodeId: string, portId: string) => {
        return portElements.current.get(`${nodeId}:${portId}`) ?? null;
    }, []);

    const getNodeState = useCallback((nodeId: string) => {
        return nodeStates.current.get(nodeId) ?? null;
    }, []);

    const updateNodeState = useCallback((state: GraphNodeRuntimeState) => {
        nodeStates.current.set(state.id, state);
    }, []);

    const value = useMemo<NodeRegistryContextValue>(() => ({
        getNodeElement,
        getPortElement,
        getNodeState,
        registerNodeElement,
        unregisterNodeElement,
        registerPortElement,
        unregisterPortElement,
        updateNodeState,
    }), [
        getNodeElement, getPortElement, getNodeState,
        registerNodeElement, unregisterNodeElement,
        registerPortElement, unregisterPortElement,
        updateNodeState,
    ]);

    return (
        <NodeRegistryContext.Provider value={value}>
            {children}
        </NodeRegistryContext.Provider>
    );
}
