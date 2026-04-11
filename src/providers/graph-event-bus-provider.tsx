import { useCallback, useRef, useMemo } from "react";
import { GraphEventBusContext } from "../context/graph-event-bus-context";
import { GraphEventBusContextValue, NodeEventCallback, NodeEventMap } from "../types";

interface GraphEventBusProviderProps {
    children: React.ReactNode;
}

/**
 * Provider que mantém um bus centralizado de eventos do grafo.
 * Permite que nós emitam eventos e links (ou outros componentes) assinem
 * eventos de nós específicos para reagir a mudanças de dados, posição, etc.
 */
export default function GraphEventBusProvider({ children }: GraphEventBusProviderProps) {
    // Map<"nodeId:eventType", Set<callback>>
    const listeners = useRef<Map<string, Set<NodeEventCallback<keyof NodeEventMap>>>>(new Map());

    const subscribe = useCallback(<K extends keyof NodeEventMap>(
        nodeId: string,
        event: K,
        listener: NodeEventCallback<K>,
    ) => {
        const key = `${nodeId}:${event}`;
        if (!listeners.current.has(key)) {
            listeners.current.set(key, new Set());
        }
        listeners.current.get(key)!.add(listener as NodeEventCallback<keyof NodeEventMap>);
    }, []);

    const unsubscribe = useCallback(<K extends keyof NodeEventMap>(
        nodeId: string,
        event: K,
        listener: NodeEventCallback<K>,
    ) => {
        const key = `${nodeId}:${event}`;
        listeners.current.get(key)?.delete(listener as NodeEventCallback<keyof NodeEventMap>);
    }, []);

    const emit = useCallback(<K extends keyof NodeEventMap>(
        nodeId: string,
        event: K,
        payload: Omit<NodeEventMap[K], "type" | "nodeId">,
    ) => {
        const key = `${nodeId}:${event}`;
        const handlers = listeners.current.get(key);
        if (!handlers) return;

        // Constrói um evento simples com type, nodeId e payload
        const eventObj = { type: event, nodeId, ...payload } as NodeEventMap[K];
        handlers.forEach(handler => {
            try {
                handler(eventObj);
            } catch (error) {
                console.error(`Erro ao despachar evento "${String(event)}" do nó "${nodeId}":`, error);
            }
        });
    }, []);

    const value = useMemo<GraphEventBusContextValue>(() => ({
        subscribe,
        unsubscribe,
        emit,
    }), [subscribe, unsubscribe, emit]);

    return (
        <GraphEventBusContext.Provider value={value}>
            {children}
        </GraphEventBusContext.Provider>
    );
}
