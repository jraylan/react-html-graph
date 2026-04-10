import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import useGraphMode from "../hooks/graph-mode";
import { GraphNodeRuntimeState, GraphObjectProps, Point3D, PortsByLocation } from "../types";
import GraphPort from "../ports/base";
import useGetZoom from "../hooks/get-zoom";

type MoveState = {
    moving: boolean,
    movePointStart: { x: number, y: number },
    startPos: { x: number, y: number }
    currentPos: { x: number, y: number }
}



/**
 * Componente que representa um objeto/nó do grafo. Gerencia posicionamento,
 * arraste (drag) e exposição das portas no local correto.
 *
 * @param props GraphObjectProps
 * @returns JSX.Element
 */
const MemoizedGraphObject = memo(function GraphObject({
    children,
    id,
    ports,
    data,
    position: controlledPosition,
    initialPosition,
    onMove,
    onStateChange,
}: GraphObjectProps) {
    const ref = useRef<HTMLDivElement>(null)
    const getZoom = useGetZoom();
    const mode = useGraphMode();
    const [position, setPosition] = useState<Point3D>(() => controlledPosition ?? initialPosition ?? { x: 0, y: 0, z: 0 });
    const effectivePosition = controlledPosition ?? position;
    const moveRef = useRef<MoveState>({
        moving: false,
        movePointStart: { x: 0, y: 0 },
        startPos: { x: 0, y: 0 },
        currentPos: { x: 0, y: 0 },
    })

    const reportState = useCallback((nextPosition: Point3D) => {
        if (!ref.current || !onStateChange) return;
        const state: GraphNodeRuntimeState = {
            id,
            position: nextPosition,
            width: Math.max(1, ref.current.offsetWidth),
            height: Math.max(1, ref.current.offsetHeight),
            data,
        };
        onStateChange(state);
    }, [data, id, onStateChange]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || mode === "readonly") return;
        e.preventDefault();
        moveRef.current.moving = true
        moveRef.current.movePointStart.x = e.clientX
        moveRef.current.movePointStart.y = e.clientY
        moveRef.current.startPos = { x: effectivePosition.x, y: effectivePosition.y }
        moveRef.current.currentPos = { x: effectivePosition.x, y: effectivePosition.y }
    }, [effectivePosition.x, effectivePosition.y, mode])

    const stopMoving = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (e.button === 0 && moveRef.current.moving) {
            moveRef.current.moving = false
            const nextPosition = {
                x: moveRef.current.currentPos.x,
                y: moveRef.current.currentPos.y,
                z: effectivePosition.z,
            };
            setPosition(nextPosition);
            onMove?.(nextPosition);
        }
    }, [effectivePosition.z, onMove])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!ref.current || !moveRef.current.moving) return;
        const zoom = getZoom();
        const dx = (e.clientX - moveRef.current.movePointStart.x) / zoom;
        const dy = (e.clientY - moveRef.current.movePointStart.y) / zoom;
        const newX = moveRef.current.startPos.x + dx;
        const newY = moveRef.current.startPos.y + dy;
        const nextPosition = {
            x: newX,
            y: newY,
            z: effectivePosition.z,
        };
        moveRef.current.currentPos.x = newX;
        moveRef.current.currentPos.y = newY;
        ref.current.style.left = `${newX.toFixed(0)}px`;
        ref.current.style.top = `${newY.toFixed(0)}px`;
        reportState(nextPosition);

    }, [effectivePosition.z, getZoom, reportState])


    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.left = `${effectivePosition.x.toFixed(0)}px`;
        ref.current.style.top = `${effectivePosition.y.toFixed(0)}px`;
        ref.current.style.zIndex = effectivePosition.z.toFixed(0);
        reportState(effectivePosition);
    }, [effectivePosition, reportState])


    useEffect(() => {
        if (mode === "readonly") return;

        const handlerUp = (e: MouseEvent) => {
            stopMoving(e);
        }
        const handleMove = (e: MouseEvent) => {
            handleMouseMove(e)
        }
        document.addEventListener('mouseup', handlerUp)
        document.addEventListener('mousemove', handleMove)

        return () => {
            document.removeEventListener('mouseup', handlerUp)
            document.removeEventListener('mousemove', handleMove)
        }

    }, [stopMoving, handleMouseMove, mode])

    const portsByLocation = useMemo<PortsByLocation>(() => {
        const result: PortsByLocation = {
            top: [], bottom: [], left: [], right: [], floating: [], all: [],
        };

        for (const port of ports ?? []) {
            const element = (
                <GraphPort
                    key={port.id}
                    type={port.type}
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
                z: controlledPosition.z ?? 0
            });
            return;
        }
        if (initialPosition) {
            setPosition({
                x: initialPosition.x,
                y: initialPosition.y,
                z: initialPosition.z ?? 0
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
    }, [effectivePosition, onStateChange, reportState]);

    return <node-graph-object
        key={id}
        ref={ref}
        onMouseDown={handleMouseDown}
        onMouseUp={stopMoving}
        node-id={id}
    >
        {children({ id, ports: portsByLocation, data })}
    </node-graph-object>
})

export default MemoizedGraphObject;