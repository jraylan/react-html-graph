import { useContext, useCallback } from "react";
import { ConnectionContext } from "../context/connection-context";
import { GraphContext } from "../context/graph-context";
import { ConnectionType } from "../types";
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
 * @param portName Nome da porta
 * @param connectionType Tipo de conexão suportada
 * @returns dragHandlers, isDragging, canDrag
 */
export function usePortDrag(nodeId: string, portName: string, connectionType: ConnectionType) {
    const { startDrag, dragState } = useContext(ConnectionContext);
    const { mode } = useContext(GraphContext);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (mode === "readonly") return;
            e.stopPropagation();
            e.preventDefault();
            startDrag(nodeId, portName, connectionType);
        },
        [mode, nodeId, portName, connectionType, startDrag]
    );

    const isDragging =
        dragState.active &&
        dragState.sourceNodeId === nodeId &&
        dragState.sourcePortName === portName;

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
 * @param portName Nome da porta
 * @param connectionType Tipo de conexão suportada
 * @returns dropHandlers, canDrop
 */
export function usePortDrop(nodeId: string, portName: string, connectionType: ConnectionType) {
    const { dragState, endDrag } = useContext(ConnectionContext);
    const { mode } = useContext(GraphContext);
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

            endDrag(nodeId, portName, cursorPos);
        },
        [mode, dragState.active, nodeId, portName, endDrag, getViewbox, graphRoot]
    );

    return {
        dropHandlers: { onMouseUp: handleMouseUp },
        canDrop,
    };
}
