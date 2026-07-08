import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import { GraphExternalMoveEvent, GraphNodeRuntimeState, GraphObjectProps, NodeEventEmitter, Point3D, PortsByLocation } from "../types";
import GraphPort from "../ports/base";
import { NodeEventProvider } from "../providers/node-event-context";
import { useMoveBehaviour } from "../behaviour/move-behaviour";
import useNodeRegistry from "../hooks/node-registry";
import useGraphEventBus from "../hooks/graph-event-bus";
import { useGraphRoot } from "../module";

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
    mode,
    getZoom,
    ports,
    data,
    initialPosition,
    onMove,
    onStateChange,
    snapGrid,
    getMoveGroup,
}: GraphObjectProps<T>) {
    const ref = useRef<HTMLDivElement>(null);
    const root = useGraphRoot();
    const registry = useNodeRegistry();
    const eventBus = useGraphEventBus();
    const [eventEmitter, setEmitter] = useState<NodeEventEmitter | null>(null);
    const [position, setPosition] = useState<Point3D>(() => initialPosition ?? { x: 0, y: 0, z: 0 });
    const visibilityRef = useRef(false);

    // Registra/desregistra o elemento DOM do nó no NodeRegistry
    useEffect(() => {
        if (!ref.current) return;
        registry.registerNodeElement(id, ref.current);
        return () => registry.unregisterNodeElement(id);
    }, [id, registry]);

    const reportState = useCallback((nextPosition: Point3D, phase: "live" | "commit" = "commit") => {
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
        eventBus.emit(id, "move", { position: nextPosition, phase });
        // Reporta via callback do Graph
        onStateChange?.(state);
    }, [data, id, onStateChange, registry, eventBus]);

    const handleEmitterReady = useCallback((emitFn: NodeEventEmitter) => {
        setEmitter(() => emitFn);
    }, []);

    // Última posição consolidada do nó (com snap). Usada como
    // referência do delta ao arrastar um grupo.
    const commitPosRef = useRef<Point3D>(
        initialPosition ?? { x: 0, y: 0, z: 0 },
    );

    // Callback chamado ao finalizar o arraste
    const handleMoveEnd = useCallback((nextPosition: Point3D) => {
        commitPosRef.current = nextPosition;
        setPosition(nextPosition);
        onMove?.(nextPosition);
    }, [onMove]);

    // Estado do arraste de grupo (só no nó que o mouse arrasta):
    // captura a posição inicial de cada membro e emite externalMove
    // para que cada um se reposicione mantendo a distância relativa.
    const grupoRef = useRef<{
        membros: string[];
        inicios: Map<string, Point3D>;
        inicioProprio: Point3D;
        acumulado: { x: number; y: number };
    } | null>(null);

    const aoDelta = useCallback((
        dx: number,
        dy: number,
        phase: "start" | "live" | "commit",
    ) => {
        if (!getMoveGroup) return;

        if (phase === "start") {
            const membros = getMoveGroup(id).filter((m) => m !== id);
            if (membros.length === 0) {
                grupoRef.current = null;
                return;
            }
            const inicios = new Map<string, Point3D>();
            for (const m of membros) {
                const st = registry.getNodeState(m);
                if (st) inicios.set(m, { ...st.position });
            }
            const meu = registry.getNodeState(id);
            grupoRef.current = {
                membros,
                inicios,
                inicioProprio: meu
                    ? { ...meu.position }
                    : { ...commitPosRef.current },
                acumulado: { x: 0, y: 0 },
            };
            return;
        }

        const g = grupoRef.current;
        if (!g) return;

        if (phase === "live") {
            g.acumulado.x += dx;
            g.acumulado.y += dy;
            for (const m of g.membros) {
                const ini = g.inicios.get(m);
                if (!ini) continue;
                eventBus.emit(m, "externalMove", {
                    position: {
                        x: ini.x + g.acumulado.x,
                        y: ini.y + g.acumulado.y,
                        z: ini.z,
                    },
                    phase: "live",
                });
            }
            return;
        }

        // commit: usa a posição final (com snap) do nó arrastado.
        const fim = commitPosRef.current;
        const totalX = fim.x - g.inicioProprio.x;
        const totalY = fim.y - g.inicioProprio.y;
        for (const m of g.membros) {
            const ini = g.inicios.get(m);
            if (!ini) continue;
            eventBus.emit(m, "externalMove", {
                position: {
                    x: ini.x + totalX,
                    y: ini.y + totalY,
                    z: ini.z,
                },
                phase: "commit",
            });
        }
        grupoRef.current = null;
    }, [getMoveGroup, id, registry, eventBus]);

    const { handleMouseDown, handleMouseUp, moveRef } = useMoveBehaviour({
        elementRef: ref,
        getZoom,
        mode,
        position,
        onMoveEnd: handleMoveEnd,
        onMoving: (nextPosition) => reportState(nextPosition, "live"),
        eventEmitter,
        snapGrid,
        onDelta: getMoveGroup ? aoDelta : undefined,
    });

    // Recebe pedidos de movimento externo (arraste de grupo): move
    // a si mesmo atualizando o registry e emitindo "move" para que
    // os paths conectados acompanhem.
    useEffect(() => {
        const aoMoverExterno = (ev: GraphExternalMoveEvent) => {
            if (!ref.current) return;
            if (ev.phase === "commit") {
                commitPosRef.current = ev.position;
                setPosition(ev.position);
            } else {
                ref.current.style.left = `${ev.position.x.toFixed(0)}px`;
                ref.current.style.top = `${ev.position.y.toFixed(0)}px`;
                reportState(ev.position, "live");
            }
        };
        eventBus.subscribe(id, "externalMove", aoMoverExterno);
        return () => {
            eventBus.unsubscribe(id, "externalMove", aoMoverExterno);
        };
    }, [id, eventBus, reportState]);

    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.left = `${position.x.toFixed(0)}px`;
        ref.current.style.top = `${position.y.toFixed(0)}px`;
        ref.current.style.zIndex = position.z.toFixed(0);
        reportState(position, "commit");
    }, [position, reportState]);

    const portsByLocation = useMemo<PortsByLocation>(() => {
        const result: PortsByLocation = {
            top: [], bottom: [], left: [], right: [], floating: [], all: [],
        };

        for (const port of ports ?? []) {
            const element = (
                <GraphPort
                    key={port.id}
                    connectionType={port.connectionType}
                    mode={mode}
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
    }, [ports, id, mode]);

    useEffect(() => {
        if (initialPosition) {
            setPosition({
                x: initialPosition.x,
                y: initialPosition.y,
                z: initialPosition.z ?? 0,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialPosition?.x, initialPosition?.y, initialPosition?.z]);

    useEffect(() => {
        if (!ref.current || !onStateChange) return;
        const observer = new ResizeObserver(() => {
            reportState(
                moveRef.current.moving
                    ? {
                        x: moveRef.current.currentPos.x,
                        y: moveRef.current.currentPos.y,
                        z: position.z,
                    }
                    : position,
                moveRef.current.moving ? "live" : "commit",
            );
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [position, moveRef, onStateChange, reportState]);

    // Emite evento dataChange no bus centralizado e no NodeEventProvider local
    useEffect(() => {
        eventBus.emit(id, "dataChange", { data });
        if (eventEmitter) {
            eventEmitter("dataChange", { data });
        }
    }, [eventBus, eventEmitter, data, id]);


    useEffect(() => {
        if (!ref.current || !root.current) return;
        const observer = new IntersectionObserver((e) => {
            if (!ref.current) return;
            const itr = e[0];
            let isVisible = !itr.isIntersecting;
            if (isVisible !== visibilityRef.current) {
                eventEmitter?.("visibilityChange", {
                    isVisible: visibilityRef.current,
                    boundingClientRect: itr.boundingClientRect.toJSON(),
                    intersectionRatio: itr.intersectionRatio,
                    intersectionRect: itr.intersectionRect.toJSON(),
                    rootBounds: itr.rootBounds?.toJSON(),
                });
            }
            visibilityRef.current = isVisible;
        }, {
            root: root.current,
        });
        observer.observe(ref.current!);
        return () => observer.disconnect();
    }, [root, eventEmitter]);


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
