

import { useEffect, useContext, useCallback } from "react";
import { usePortDrag, usePortDrop } from "../hooks/connection";
import { ConnectionContext } from "../context/connection-context";
import useGraphMode from "../hooks/graph-mode";
import { GraphPortProps } from "../types";



/**
 * Componente que representa uma porta de nó (input/output/bidirectional).
 * Registra a porta no contexto de conexões e fornece handlers de arraste
 * e drop conforme o modo do graph.
 *
 * @param props Propriedades da porta (GraphPortProps)
 * @returns JSX.Element
 */
export default function GraphPort({
    onClick, onMouseOver, onMouseLeave, ...props
}: GraphPortProps) {
    const { registerPort, unregisterPort, getGraphApi } = useContext(ConnectionContext);
    const mode = useGraphMode();
    const { dragHandlers, isDragging, canDrag } = usePortDrag(
        props.nodeId,
        props.id,
        props.type
    );
    const { dropHandlers, canDrop } = usePortDrop(
        props.nodeId,
        props.id,
        props.type
    );

    useEffect(() => {
        registerPort({
            nodeId: props.nodeId,
            portName: props.id,
            connectionType: props.type,
            direction: props.direction,
            onDragEnd: props.onDragEnd,
        });
        return () => {
            unregisterPort(props.nodeId, props.id);
        };
    }, [
        props.nodeId,
        props.id,
        props.type,
        props.direction,
        props.onDragEnd,
        registerPort,
        unregisterPort,
    ]);

    const forwardClickEvents = useCallback((event: React.MouseEvent) => {
        if (!onClick) return;
        const api = getGraphApi();
        if (!api) return;
        onClick({
            type: 'click',
            graph: {
                type: props.type,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });

    }, [getGraphApi, onClick, props.direction, props.id, props.nodeId, props.type])

    const forwardMouseOverEvents = useCallback((event: React.MouseEvent) => {
        if (!onMouseOver) return;
        const api = getGraphApi();
        if (!api) return;
        onMouseOver({
            type: 'mouseOver',
            graph: {
                type: props.type,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });

    }, [getGraphApi, onMouseOver, props.direction, props.id, props.nodeId, props.type]);

    const forwardMouseLeaveEvents = useCallback((event: React.MouseEvent) => {
        if (!onMouseLeave) return;
        const api = getGraphApi();
        if (!api) return;
        onMouseLeave({
            type: 'mouseLeave',
            graph: {
                type: props.type,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });
    }, [getGraphApi, onMouseLeave, props.direction, props.id, props.nodeId, props.type]);


    const isOutput = props.direction === "output" || props.direction === "bidirectional";
    const isInput = props.direction === "input" || props.direction === "bidirectional";

    const handlers =
        mode === "edit"
            ? {
                ...(isOutput ? dragHandlers : {}),
                ...(isInput ? dropHandlers : {}),
            }
            : {};

    const portAttr =
        props.direction === "bidirectional"
            ? "bidirectional"
            : props.direction;

    return (
        <node-graph-port
            {...handlers}
            onClick={forwardClickEvents}
            onMouseOver={forwardMouseOverEvents}
            onMouseLeave={forwardMouseLeaveEvents}
            node-port={portAttr}
            port-id={props.id}
        >
            {props.children({
                type: props.type,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
                location: props.location,
                isDragging,
                canDrop,
                canDrag,
            })}
        </node-graph-port>
    );
}
