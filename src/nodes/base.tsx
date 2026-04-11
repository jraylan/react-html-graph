import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import useGraphMode from "../hooks/graph-mode";
import { GraphNodeRuntimeState, GraphObjectProps, NodeEventEmitter, Point3D, PortsByLocation } from "../types";
import GraphPort from "../ports/base";
import useGetZoom from "../hooks/get-zoom";
import { NodeEventProvider } from "../providers/node-event-context";
import { useMoveBehaviour } from "../behaviour/move-behaviour";
import useNodeRegistry from "../hooks/node-registry";
import useGraphEventBus from "../hooks/graph-event-bus";

/**
 * Componente que representa um objeto/nó do grafo. Gerencia posicionamento,
 * arraste (drag) e exposição das portas no local correto.
 * Registra-se no NodeRegistry e emite eventos via GraphEventBus.
 *
 * @param props GraphObjectProps
 * @returns JSX.Element
 */
const MemoizedGraphObject = memo(function GraphObject<T extends object = any>({
    children,
    id,
    ports,
    data,
    position: controlledPosition,
    initialPosition,
    onMove,
    onStateChange,
}: GraphObjectProps<T>) {
    const ref = useRef<HTMLDivElement>(null);
    const getZoom = useGetZoom();
    const mode = useGraphMode();
    const registry = useNodeRegistry();
    const eventBus = useGraphEventBus();
    const [eventEmitter, setEmitter] = useState<NodeEventEmitter | null>(null);
    const [position, setPosition] = useState<Point3D>(() => controlledPosition ?? initialPosition ?? { x: 0, y: 0, z: 0 });
    const effectivePosition = controlledPosition ?? position;

    // Registra/desregistra o elemento DOM do nó no NodeRegistry
    useEffect(() => {
        if (!ref.current) return;
        registry.registerNodeElement(id, ref.current);
        return () => registry.unregisterNodeElement(id);
    }, [id, registry]);

    const reportState = useCallback((nextPosition: Point3D) => {
        if (!ref.current) return;
        const state: GraphNodeRuntimeState<T> = {
            id,
            position: nextPosition,
            width: Math.max(1, ref.current.offsetWidth),
            height: Math.max(1, ref.current.offsetHeight),
            data,
        };
        // Atualiza o registry centralizado
        registry.updateNodeState(state);
        // Emite evento de movimento no bus centralizado
        eventBus.emit(id, "move", { position: nextPosition });
        // Reporta via callback do Graph
        onStateChange?.(state);
    }, [data, id, onStateChange, registry, eventBus]);

    const handleEmitterReady = useCallback((emitFn: NodeEventEmitter) => {
        setEmitter(() => emitFn);
    }, []);

    // Callback chamado ao finalizar o arraste
    const handleMoveEnd = useCallback((nextPosition: Point3D) => {
        setPosition(nextPosition);
        onMove?.(nextPosition);
    }, [onMove]);

    const { handleMouseDown, handleMouseUp, moveRef } = useMoveBehaviour({
        elementRef: ref,
        getZoom,
        mode,
        effectivePosition,
        onMoveEnd: handleMoveEnd,
        onMoving: reportState,
        eventEmitter,
    });

    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.left = `${effectivePosition.x.toFixed(0)}px`;
        ref.current.style.top = `${effectivePosition.y.toFixed(0)}px`;
        ref.current.style.zIndex = effectivePosition.z.toFixed(0);
        reportState(effectivePosition);
    }, [effectivePosition, reportState]);

    const portsByLocation = useMemo<PortsByLocation>(() => {
        const result: PortsByLocation = {
            top: [], bottom: [], left: [], right: [], floating: [], all: [],
        };

        for (const port of ports ?? []) {
            const element = (
                <GraphPort
                    key={port.id}
                    connectionType={port.connectionType}
                    id={port.id}
                    nodeId={id}
                    direction={port.direction}
                    location={port.location}
                    onDragEnd={port.onDragEnd}
                >
                    {port.children}
                </GraphPort>
            );

            if (typeof port.location === "string" && port.location in result) {
                result[port.location as keyof Omit<PortsByLocation, "all">].push(element);
            } else if (typeof port.location === "object") {
                result.floating.push(element);
            }
            result.all.push(element);
        }

        return result;
    }, [ports, id]);

    useEffect(() => {
        if (controlledPosition) {
            setPosition({
                x: controlledPosition.x,
                y: controlledPosition.y,
                z: controlledPosition.z ?? 0,
            });
            return;
        }
        if (initialPosition) {
            setPosition({
                x: initialPosition.x,
                y: initialPosition.y,
                z: initialPosition.z ?? 0,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlledPosition?.x, controlledPosition?.y, controlledPosition?.z, initialPosition?.x, initialPosition?.y, initialPosition?.z]);

    useEffect(() => {
        if (!ref.current || !onStateChange) return;
        const observer = new ResizeObserver(() => {
            reportState(moveRef.current.moving
                ? {
                    x: moveRef.current.currentPos.x,
                    y: moveRef.current.currentPos.y,
                    z: effectivePosition.z,
                }
                : effectivePosition
            );
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [effectivePosition, moveRef, onStateChange, reportState]);

    // Emite evento dataChange no bus centralizado e no NodeEventProvider local
    useEffect(() => {
        eventBus.emit(id, "dataChange", { data });
        if (eventEmitter) {
            eventEmitter("dataChange", { data });
        }
    }, [eventBus, eventEmitter, data, id]);

    return <node-graph-object
        key={id}
        ref={ref}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        node-id={id}
    >
        <NodeEventProvider nodeId={id} emitter={handleEmitterReady} >
            {children({ id, ports: portsByLocation, data })}
        </NodeEventProvider>
    </node-graph-object>;
});

export default MemoizedGraphObject;
