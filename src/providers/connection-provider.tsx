import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ConnectionContext } from "../context/connection-context";
import { PortConnection, ConnectionType, ConnectionProviderProps, DragState, PortRegistration, ConnectionApi, ConnectionContextProps } from "../types";
import useGraphRoot from "../hooks/graph-root";


/**
 * Provider que gerencia o estado de conexões e arraste entre portas. Expõe a
 * API de conexões e o estado de drag através do ConnectionContext.
 *
 * @param props Propriedades do provider (ConnectionProviderProps)
 * @returns JSX.Element
 */
export default function ConnectionProvider({ graphApi, children, mode, viewboxRef }: ConnectionProviderProps) {
    const [connections, setConnections] = useState<PortConnection[]>([]);
    const [portRegistryVersion, setPortRegistryVersion] = useState(0);
    const [dragState, setDragState] = useState<DragState>({ active: false });
    const dragStateRef = useRef<DragState>({ active: false });
    const connectionsRef = useRef<PortConnection[]>([]);
    const portRegistry = useRef<Map<string, PortRegistration>>(new Map());
    const tempLinkListeners = useRef<Set<() => void>>(new Set());
    const tempLinkNotifyRafRef = useRef(0);
    const graphRoot = useGraphRoot();
    const connectionApiRef = useRef<ConnectionApi | null>(null);
    connectionsRef.current = connections;

    const registerPort = useCallback((reg: PortRegistration) => {
        portRegistry.current.set(`${reg.nodeId}:${reg.PortID}`, reg);
        setPortRegistryVersion(prev => prev + 1);
    }, []);

    const unregisterPort = useCallback((nodeId: string, PortID: string) => {
        portRegistry.current.delete(`${nodeId}:${PortID}`);
        setPortRegistryVersion(prev => prev + 1);
    }, []);

    const getPortRegistration = useCallback((nodeId: string, PortID: string) => {
        return portRegistry.current.get(`${nodeId}:${PortID}`) ?? null;
    }, []);

    const notifyTempLinkListeners = useCallback(() => {
        cancelAnimationFrame(tempLinkNotifyRafRef.current);
        tempLinkNotifyRafRef.current = requestAnimationFrame(() => {
            tempLinkListeners.current.forEach(listener => listener());
        });
    }, []);

    const getTempLinkState = useCallback(() => {
        return dragStateRef.current;
    }, []);

    const subscribeTempLink = useCallback((listener: () => void) => {
        tempLinkListeners.current.add(listener);
        return () => tempLinkListeners.current.delete(listener);
    }, []);

    const getGraphApi = useCallback(() => {
        return graphApi;
    }, [graphApi]);

    const connect = useCallback((connection: PortConnection): void => {
        if (mode === "readonly") return;
        setConnections(prev => [...prev, connection]);
    }, [mode]);

    const disconnect = useCallback((connection: PortConnection): void => {
        if (mode === "readonly") return;
        setConnections(prev =>
            prev.filter(
                c =>
                    !(
                        c.from.nodeId === connection.from.nodeId &&
                        c.from.PortID === connection.from.PortID &&
                        c.to.nodeId === connection.to.nodeId &&
                        c.to.PortID === connection.to.PortID
                    )
            )
        );
    }, [mode]);

    const startDrag = useCallback(
        (sourceNodeId: string, sourcePortID: string, connectionType: ConnectionType, cursorPosition?: { x: number; y: number }) => {
            if (mode === "readonly") return;
            const state: DragState = {
                active: true,
                sourceNodeId,
                sourcePortID,
                connectionType,
                cursorPosition: cursorPosition ?? { x: 0, y: 0 },
            };
            dragStateRef.current = state;
            setDragState(state);
            notifyTempLinkListeners();
        },
        [mode, notifyTempLinkListeners]
    );

    const updateDragCursor = useCallback((cursorPosition: { x: number; y: number }) => {
        const current = dragStateRef.current;
        if (!current.active) return;
        if (
            current.cursorPosition.x === cursorPosition.x
            && current.cursorPosition.y === cursorPosition.y
        ) {
            return;
        }

        dragStateRef.current = {
            ...current,
            cursorPosition,
        };
        notifyTempLinkListeners();
    }, [notifyTempLinkListeners]);

    const endDrag = useCallback(
        async (targetNodeId?: string, targetPortID?: string, cursorPosition?: { x: number; y: number }) => {
            const current = dragStateRef.current;
            if (!current.active) return;

            // Evita reentradas causadas por mouseup global
            dragStateRef.current = { active: false };
            notifyTempLinkListeners();

            const sourceKey = `${current.sourceNodeId}:${current.sourcePortID}`;
            const sourcePort = portRegistry.current.get(sourceKey);

            if (sourcePort?.onDragEnd) {
                try {
                    await sourcePort.onDragEnd(graphApi, {
                        sourceNodeId: current.sourceNodeId,
                        sourcePortID: current.sourcePortID,
                        connectionType: current.connectionType,
                        targetNodeId,
                        targetPortID,
                        cursorPosition: cursorPosition ?? { x: 0, y: 0 },
                    });
                } catch (_e) {
                    // Erro no callback - o link temporário ainda será limpo
                }
            }

            // Oculta o link temporário após o callback finalizar
            setDragState({ active: false });
        },
        [graphApi, notifyTempLinkListeners]
    );

    const dragOverPort = useCallback((targetNodeId: string, targetPortID: string): void => {
        const current = dragStateRef.current;
        if (!current.active) return;
        if (current.targetNodeId === targetNodeId && current.targetPortID === targetPortID) return;

        dragStateRef.current = {
            ...current,
            targetNodeId,
            targetPortID,
        };
        notifyTempLinkListeners();
    }, [notifyTempLinkListeners]);

    const dragLeavePort = useCallback((): void => {
        const current = dragStateRef.current;
        if (!current.active) return;
        if (!current.targetNodeId && !current.targetPortID) return;

        dragStateRef.current = {
            ...current,
            targetNodeId: undefined,
            targetPortID: undefined,
        };
        notifyTempLinkListeners();
    }, [notifyTempLinkListeners]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStateRef.current.active) return;

            const vb = viewboxRef.current;
            const graph = graphRoot.current;
            if (!graph) return;

            const rect = graph.getBoundingClientRect();
            updateDragCursor({
                x: (e.clientX - rect.left) / vb.zoom + vb.x,
                y: (e.clientY - rect.top) / vb.zoom + vb.y,
            });
        };

        document.addEventListener("mousemove", handleMouseMove);
        return () => document.removeEventListener("mousemove", handleMouseMove);
    }, [graphRoot, updateDragCursor, viewboxRef]);

    // mouseup global: encerra o arraste quando clicado em espaço vazio
    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            if (!dragStateRef.current.active) return;

            const vb = viewboxRef.current;
            const graph = graphRoot.current;
            let cursorPos = { x: 0, y: 0 };
            if (graph) {
                const rect = graph.getBoundingClientRect();
                cursorPos = {
                    x: (e.clientX - rect.left) / vb.zoom + vb.x,
                    y: (e.clientY - rect.top) / vb.zoom + vb.y,
                };
            }

            endDrag(undefined, undefined, cursorPos);
        };
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [endDrag, graphRoot, viewboxRef]);

    useEffect(() => {
        return () => cancelAnimationFrame(tempLinkNotifyRafRef.current);
    }, []);

    const value = useMemo((): ConnectionContextProps => {
        connectionApiRef.current = {
            connect,
            disconnect,
            getConnections: () => connectionsRef.current,
        }
        return {
            connections,
            portRegistryVersion,
            dragState,
            getGraphApi,
            connect,
            disconnect,
            startDrag,
            dragOverPort,
            dragLeavePort,
            endDrag,
            registerPort,
            getPortRegistration,
            getTempLinkState,
            subscribeTempLink,
            unregisterPort,
        }
    }, [
        connections, dragState, portRegistryVersion,
        getGraphApi, connect,
        disconnect, startDrag,
        endDrag, registerPort,
        getPortRegistration,
        getTempLinkState,
        subscribeTempLink,
        unregisterPort, dragOverPort,
        dragLeavePort,
    ]);



    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}
