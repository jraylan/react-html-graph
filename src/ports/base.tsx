

import { useEffect, useContext, useCallback, useRef } from "react";
import { usePortDrag, usePortDrop } from "../hooks/connection";
import { ConnectionContext } from "../context/connection-context";
import useNodeRegistry from "../hooks/node-registry";
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
    const registry = useNodeRegistry();
    const portRef = useRef<HTMLDivElement>(null);
    const { dragHandlers, isDragging, canDrag } = usePortDrag(
        props.nodeId,
        props.id,
        props.connectionType,
        props.mode,
    );
    const { dropHandlers, canDrop } = usePortDrop(
        props.nodeId,
        props.id,
        props.connectionType,
        props.mode,
    );
    const connectionContext = useContext(ConnectionContext);
    const connectionContextRef = useRef<typeof connectionContext>(connectionContext);

    useEffect(() => {
        registerPort({
            nodeId: props.nodeId,
            PortID: props.id,
            connectionType: props.connectionType,
            direction: props.direction,
            location: props.location,
            onDragEnd: props.onDragEnd,
        });
        return () => {
            unregisterPort(props.nodeId, props.id);
        };
    }, [
        props.nodeId,
        props.id,
        props.connectionType,
        props.direction,
        props.location,
        props.onDragEnd,
        registerPort,
        unregisterPort,
    ]);

    useEffect(() => {
        connectionContextRef.current = connectionContext;
    }, [connectionContext])

    // Registra o elemento DOM da porta no NodeRegistry
    useEffect(() => {
        if (!portRef.current) return;
        registry.registerPortElement(props.nodeId, props.id, portRef.current);
        return () => registry.unregisterPortElement(props.nodeId, props.id);
    }, [props.nodeId, props.id, registry]);

    const notifyDraggingOver = useCallback(() => {
        const { active } = connectionContextRef.current.dragState;
        if (!active || props.direction === "output") return;

        connectionContextRef.current.dragOverPort(
            props.nodeId,
            props.id,
            props.connectionType
        );
    }, [props.nodeId, props.id, props.connectionType, props.direction]);


    const notifyDraggingLeave = useCallback(() => {
        const currentDragState = connectionContextRef.current.getTempLinkState();
        const { active } = currentDragState;
        if (!active) return;
        const { targetNodeId, targetPortID } = currentDragState;
        if (
            active &&
            targetNodeId === props.nodeId &&
            targetPortID === props.id
        ) {
            connectionContextRef.current.dragLeavePort();
        }
    }, [props.nodeId, props.id]);

    const forwardClickEvents = useCallback((event: React.MouseEvent) => {
        if (!onClick) return;
        const api = getGraphApi();
        if (!api) return;
        onClick({
            type: 'click',
            graph: {
                connectionType: props.connectionType,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });

    }, [getGraphApi, onClick, props.direction, props.id, props.nodeId, props.connectionType])

    const forwardMouseOverEvents = useCallback((event: React.MouseEvent) => {
        notifyDraggingOver()
        if (!onMouseOver) return;
        const api = getGraphApi();
        if (!api) return;
        onMouseOver({
            type: 'mouseOver',
            graph: {
                connectionType: props.connectionType,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });

    }, [notifyDraggingOver, getGraphApi, onMouseOver, props.direction, props.id, props.nodeId, props.connectionType]);

    const forwardMouseLeaveEvents = useCallback((event: React.MouseEvent) => {
        notifyDraggingLeave()
        if (!onMouseLeave) return;
        const api = getGraphApi();
        if (!api) return;
        onMouseLeave({
            type: 'mouseLeave',
            graph: {
                connectionType: props.connectionType,
                id: props.id,
                nodeId: props.nodeId,
                direction: props.direction,
            },
            nativeEvent: event.nativeEvent,
            api,
        });
    }, [notifyDraggingLeave, getGraphApi, onMouseLeave, props.direction, props.id, props.nodeId, props.connectionType]);


    const isOutput = props.direction === "output" || props.direction === "bidirectional";
    const isInput = props.direction === "input" || props.direction === "bidirectional";

    const handlers =
        props.mode === "edit"
            ? {
                ...(isOutput ? dragHandlers : {}),
                ...(isInput ? dropHandlers : {}),
            }
            : {};

    const portAttr =
        props.direction === "bidirectional"
            ? "bidirectional"
            : props.direction;
    const portLocationAttr = typeof props.location === "string"
        ? props.location
        : "vector";

    return (
        <node-graph-port
            ref={portRef}
            {...handlers}
            onClick={forwardClickEvents}
            onMouseOver={forwardMouseOverEvents}
            onMouseLeave={forwardMouseLeaveEvents}
            node-port={portAttr}
            port-location={portLocationAttr}
            port-id={props.id}
        >
            {props.children({
                connectionType: props.connectionType,
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
