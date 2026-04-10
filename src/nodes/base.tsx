import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import useGraphMode from "../hooks/graph-mode";
import { GraphObjectProps, Point3D, PortsByLocation } from "../types";
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
const MemoizedGraphObject = memo(function GraphObject({ children, id, ports, data, initialPosition, onMove }: GraphObjectProps) {
    const ref = useRef<HTMLDivElement>(null)
    const getZoom = useGetZoom();
    const mode = useGraphMode();
    const [position, setPosition] = useState<Point3D>(() => initialPosition ?? { x: 0, y: 0, z: 0 });
    const moveRef = useRef<MoveState>({
        moving: false,
        movePointStart: { x: 0, y: 0 },
        startPos: { x: 0, y: 0 },
        currentPos: { x: 0, y: 0 },
    })

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || mode === "readonly") return;
        e.preventDefault();
        moveRef.current.moving = true
        moveRef.current.movePointStart.x = e.clientX
        moveRef.current.movePointStart.y = e.clientY
        moveRef.current.startPos = { x: position.x, y: position.y }
        moveRef.current.currentPos = { x: position.x, y: position.y }
    }, [position, mode])

    const stopMoving = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (e.button === 0 && moveRef.current.moving) {
            moveRef.current.moving = false
            setPosition(prev => ({
                x: moveRef.current.currentPos.x,
                y: moveRef.current.currentPos.y,
                z: prev.z
            }));
        }
    }, [])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!ref.current || !moveRef.current.moving) return;
        const zoom = getZoom();
        const dx = (e.clientX - moveRef.current.movePointStart.x) / zoom;
        const dy = (e.clientY - moveRef.current.movePointStart.y) / zoom;
        const newX = moveRef.current.startPos.x + dx;
        const newY = moveRef.current.startPos.y + dy;
        moveRef.current.currentPos.x = newX;
        moveRef.current.currentPos.y = newY;
        ref.current.style.left = `${newX.toFixed(0)}px`;
        ref.current.style.top = `${newY.toFixed(0)}px`;

    }, [getZoom])


    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.left = `${position.x.toFixed(0)}px`;
        ref.current.style.top = `${position.y.toFixed(0)}px`;
        ref.current.style.zIndex = position.z.toFixed(0);
    }, [position])


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
        if (onMove) {
            onMove({ x: position.x, y: position.y, z: position.z });
        }
        if (ref.current) {
            ref.current.style.zIndex = position.z.toFixed(0);
        }
    }, [position, onMove])

    useEffect(() => {
        if (initialPosition) {
            setPosition({
                x: initialPosition.x,
                y: initialPosition.y,
                z: initialPosition.z ?? 0
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialPosition?.x, initialPosition?.y, initialPosition?.z]);

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