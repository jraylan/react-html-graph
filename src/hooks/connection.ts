import { useContext, useCallback } from "react";
import { ConnectionContext } from "../context/connection-context";
import { ConnectionType, GraphMode } from "../types";
import useGraphRoot from "./graph-root";
import useGetViewbox from "./get-viewbox";

/**
 * Hook que expõe o estado de conexões e operações básicas (connect/disconnect)
 * a partir do ConnectionContext.
 *
 * @returns {{ connections: PortConnection[], connect: Function, disconnect: Function }}
 */
export function useConnections() {
    const { connections, connect, disconnect } = useContext(ConnectionContext);
    return { connections, connect, disconnect };
}

/**
 * Hook que fornece handlers de drag para uma porta específica. Inicia o
 * processo de arraste quando o usuário pressiona a porta (somente em modo
 * de edição).
 *
 * @param nodeId Id do nó que contém a porta
 * @param PortID Nome da porta
 * @param connectionType Tipo de conexão suportada
 * @returns dragHandlers, isDragging, canDrag
 */
export function usePortDrag(nodeId: string, PortID: string, connectionType: ConnectionType, mode: GraphMode) {
    const { startDrag, dragState } = useContext(ConnectionContext);
    const graphRoot = useGraphRoot();
    const getViewbox = useGetViewbox();

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (mode === "readonly") return;
            e.stopPropagation();
            e.preventDefault();
            const graph = graphRoot.current;
            let cursorPosition = { x: 0, y: 0 };
            if (graph) {
                const rect = graph.getBoundingClientRect();
                const viewbox = getViewbox();
                cursorPosition = {
                    x: (e.clientX - rect.left) / viewbox.zoom + viewbox.x,
                    y: (e.clientY - rect.top) / viewbox.zoom + viewbox.y,
                };
            }

            startDrag(nodeId, PortID, connectionType, cursorPosition);
        },
        [mode, nodeId, PortID, connectionType, startDrag, getViewbox, graphRoot]
    );

    const isDragging =
        dragState.active &&
        dragState.sourceNodeId === nodeId &&
        dragState.sourcePortID === PortID;

    return {
        dragHandlers: { onMouseDown: handleMouseDown },
        isDragging,
        canDrag: mode === "edit",
    };
}

/**
 * Hook que fornece handlers de drop para uma porta específica. Finaliza o
 * arraste e chama endDrag quando o usuário solta sobre a porta (somente em
 * modo de edição).
 *
 * @param nodeId Id do nó que contém a porta
 * @param PortID Id da porta
 * @param connectionType Tipo de conexão suportada
 * @returns dropHandlers, canDrop
 */
export function usePortDrop(nodeId: string, PortID: string, connectionType: ConnectionType, mode: GraphMode) {
    const { dragState, endDrag } = useContext(ConnectionContext);
    const graphRoot = useGraphRoot();
    const getViewbox = useGetViewbox();

    const canDrop =
        dragState.active &&
        dragState.connectionType === connectionType &&
        dragState.sourceNodeId !== nodeId;

    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (mode === "readonly" || !dragState.active) return;
            e.stopPropagation();

            const graph = graphRoot.current;
            let cursorPos = { x: 0, y: 0 };
            if (graph) {
                const rect = graph.getBoundingClientRect();
                const viewbox = getViewbox();
                cursorPos = {
                    x: (e.clientX - rect.left) / viewbox.zoom + viewbox.x,
                    y: (e.clientY - rect.top) / viewbox.zoom + viewbox.y,
                };
            }

            endDrag(nodeId, PortID, cursorPos);
        },
        [mode, dragState.active, nodeId, PortID, endDrag, getViewbox, graphRoot]
    );

    return {
        dropHandlers: { onMouseUp: handleMouseUp },
        canDrop,
    };
}
