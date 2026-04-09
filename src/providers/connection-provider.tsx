import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ConnectionContext } from "../context/connection-context";
import { PortConnection, ConnectionType, ConnectionProviderProps, DragState, PortRegistration } from "../types";
import useGraphMode from "../hooks/graph-mode";
import useViewbox from "../hooks/viewbox";
import useGraphRoot from "../hooks/graph-root";


/**
 * Provider que gerencia o estado de conexões e arraste entre portas. Expõe a
 * API de conexões e o estado de drag através do ConnectionContext.
 *
 * @param props Propriedades do provider (ConnectionProviderProps)
 * @returns JSX.Element
 */
export default function ConnectionProvider({ graphApiRef, children }: ConnectionProviderProps) {
    const [connections, setConnections] = useState<PortConnection[]>([]);
    const [dragState, setDragState] = useState<DragState>({ active: false });
    const dragStateRef = useRef<DragState>({ active: false });
    const connectionsRef = useRef<PortConnection[]>([]);
    const portRegistry = useRef<Map<string, PortRegistration>>(new Map());
    const mode = useGraphMode();
    const viewbox = useViewbox();
    const graphRoot = useGraphRoot();
    const viewboxRef = useRef(viewbox);
    viewboxRef.current = viewbox;
    connectionsRef.current = connections;

    const registerPort = useCallback((reg: PortRegistration) => {
        portRegistry.current.set(`${reg.nodeId}:${reg.portName}`, reg);
    }, []);

    const unregisterPort = useCallback((nodeId: string, portName: string) => {
        portRegistry.current.delete(`${nodeId}:${portName}`);
    }, []);

    const getGraphApi = useCallback(() => {
        return graphApiRef.current;
    }, [graphApiRef]);

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
                        c.from.portName === connection.from.portName &&
                        c.to.nodeId === connection.to.nodeId &&
                        c.to.portName === connection.to.portName
                    )
            )
        );
    }, [mode]);

    const startDrag = useCallback(
        (sourceNodeId: string, sourcePortName: string, connectionType: ConnectionType) => {
            if (mode === "readonly") return;
            const state: DragState = {
                active: true,
                sourceNodeId,
                sourcePortName,
                connectionType,
                cursorPosition: { x: 0, y: 0 },
            };
            dragStateRef.current = state;
            setDragState(state);
        },
        [mode]
    );

    const endDrag = useCallback(
        async (targetNodeId?: string, targetPortName?: string, cursorPosition?: { x: number; y: number }) => {
            const current = dragStateRef.current;
            if (!current.active) return;

            // Evita reentradas causadas por mouseup global
            dragStateRef.current = { active: false };

            const sourceKey = `${current.sourceNodeId}:${current.sourcePortName}`;
            const sourcePort = portRegistry.current.get(sourceKey);

            if (sourcePort?.onDragEnd) {
                try {
                    await sourcePort.onDragEnd(graphApiRef.current!, {
                        sourceNodeId: current.sourceNodeId,
                        sourcePortName: current.sourcePortName,
                        connectionType: current.connectionType,
                        targetNodeId,
                        targetPortName,
                        cursorPosition: cursorPosition ?? { x: 0, y: 0 },
                    });
                } catch (_e) {
                    // Erro no callback - o link temporário ainda será limpo
                }
            }

            // Oculta o link temporário após o callback finalizar
            setDragState({ active: false });
        },
        [graphApiRef]
    );

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
    }, [endDrag, graphRoot]);

    const value = useMemo(
        () => ({
            connections,
            dragState,
            getGraphApi,
            connect,
            disconnect,
            startDrag,
            endDrag,
            registerPort,
            unregisterPort,
        }),
        [connections, dragState, getGraphApi, connect, disconnect, startDrag, endDrag, registerPort, unregisterPort]
    );

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}
