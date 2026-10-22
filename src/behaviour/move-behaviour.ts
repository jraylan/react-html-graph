import { useCallback, useEffect, useRef } from "react";
import { GraphMode, NodeEventEmitter, Point3D } from "../types";

type MoveState = {
    /** Button pressed over the node: the drag is armed. */
    moving: boolean;
    /** The pointer went past the threshold: the node is actually moving. */
    started: boolean;
    startPointer: { x: number; y: number };
    lastPointer: { x: number; y: number };
    currentPos: { x: number; y: number };
};

/**
 * Default distance, in screen pixels, the pointer must travel with the
 * button pressed before a click turns into a drag.
 */
export const DEFAULT_DRAG_THRESHOLD = 4;

/** Opções para o hook useMoveBehaviour. */
export interface UseMoveBehaviourOptions {
    /** Ref do elemento DOM do nó. */
    elementRef: React.RefObject<HTMLElement | null>;
    /** Getter estável para o zoom atual. */
    getZoom: () => number;
    /** Modo do grafo (readonly não permite drag). */
    mode: GraphMode;
    /** Posição efetiva atual do nó. */
    position: Point3D;
    /** Callback chamado ao finalizar o movimento. */
    onMoveEnd?: (newPosition: Point3D) => void;
    /** Grade de alinhamento (unidades de mundo); 0 desativa. */
    snapGrid?: number;
    /** Callback chamado durante o arraste para reportar estado transitório. */
    onMoving?: (currentPosition: Point3D) => void;
    /** Emitter de eventos do nó. */
    eventEmitter?: NodeEventEmitter | null;
    /**
     * Reporta o delta incremental do arraste (unidades de mundo).
     * Fase start no mousedown, live a cada mousemove, commit no
     * mouseup. Usado pelo Graph para arrastar um grupo junto.
     */
    onDelta?: (
        dx: number,
        dy: number,
        phase: "start" | "live" | "commit",
    ) => void;
    /**
     * Screen pixels the pointer travels before the node starts moving.
     * Below that it is a click: the node stays put and is not snapped
     * to ``snapGrid``. 0 moves from the first pixel.
     */
    dragThreshold?: number;
}

/** Retorno do hook useMoveBehaviour. */
export interface UseMoveBehaviourReturn {
    /** Handler de mouseDown para iniciar o arraste. */
    handleMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
    /** Handler de mouseUp para finalizar o arraste. */
    handleMouseUp: (e: MouseEvent | React.MouseEvent) => void;
    /** Posição corrente durante o arraste (via ref). */
    moveRef: React.RefObject<MoveState>;
}

/**
 * Hook que encapsula a lógica de drag/move de um nó do grafo.
 * Atualiza o DOM diretamente durante o arraste (sem setState)
 * e registra listeners globais de mousemove/mouseup no document.
 */
export function useMoveBehaviour({
    elementRef,
    getZoom,
    mode,
    position,
    onMoveEnd,
    onMoving,
    eventEmitter,
    snapGrid,
    onDelta,
    dragThreshold = DEFAULT_DRAG_THRESHOLD,
}: UseMoveBehaviourOptions): UseMoveBehaviourReturn {
    const moveRef = useRef<MoveState>({
        moving: false,
        started: false,
        startPointer: { x: 0, y: 0 },
        lastPointer: { x: 0, y: 0 },
        currentPos: { x: 0, y: 0 },
    });

    // Mousedown only arms the drag; it starts on the mousemove that goes
    // past the threshold, so the jitter of a selection click does not
    // move the node.
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if (e.button !== 0 || mode === "readonly") return;
        e.preventDefault();
        moveRef.current.moving = true;
        moveRef.current.started = false;
        moveRef.current.startPointer = { x: e.clientX, y: e.clientY };
        moveRef.current.lastPointer.x = e.clientX;
        moveRef.current.lastPointer.y = e.clientY;
        moveRef.current.currentPos = { x: position.x, y: position.y };
    }, [position.x, position.y, mode]);

    const handleMouseUp = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (e.button === 0 && moveRef.current.moving) {
            moveRef.current.moving = false;
            // Never went past the threshold: it was a click, nothing to
            // commit.
            if (!moveRef.current.started) return;
            moveRef.current.started = false;
            const snap = (v: number) =>
                snapGrid && snapGrid > 0
                    ? Math.round(v / snapGrid) * snapGrid
                    : v;
            const nextPosition: Point3D = {
                x: snap(moveRef.current.currentPos.x),
                y: snap(moveRef.current.currentPos.y),
                z: position.z,
            };
            moveRef.current.currentPos = {
                x: nextPosition.x,
                y: nextPosition.y,
            };
            onMoveEnd?.(nextPosition);
            // Commit do grupo depois de fixar a posição própria no
            // nodeStateRef (via onMoveEnd), para o Graph ler o delta
            // final ja com snap aplicado.
            onDelta?.(0, 0, "commit");
            eventEmitter?.("move", { position: nextPosition, phase: "commit" });
        }
    }, [position.z, onMoveEnd, eventEmitter, snapGrid, onDelta]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!elementRef.current || !moveRef.current.moving) return;
        if (!moveRef.current.started) {
            const travelled = Math.hypot(
                e.clientX - moveRef.current.startPointer.x,
                e.clientY - moveRef.current.startPointer.y,
            );
            if (travelled < dragThreshold) return;
            // Past the threshold: the delta counts from the mousedown, so
            // the node catches up with the pointer without jumping.
            moveRef.current.started = true;
            onDelta?.(0, 0, "start");
        }
        const zoom = getZoom();
        const dx = (e.clientX - moveRef.current.lastPointer.x) / zoom;
        const dy = (e.clientY - moveRef.current.lastPointer.y) / zoom;
        const newX = moveRef.current.currentPos.x + dx;
        const newY = moveRef.current.currentPos.y + dy;
        const nextPosition: Point3D = {
            x: newX,
            y: newY,
            z: position.z,
        };
        moveRef.current.lastPointer.x = e.clientX;
        moveRef.current.lastPointer.y = e.clientY;
        moveRef.current.currentPos.x = newX;
        moveRef.current.currentPos.y = newY;
        elementRef.current.style.left = `${newX.toFixed(0)}px`;
        elementRef.current.style.top = `${newY.toFixed(0)}px`;
        onMoving?.(nextPosition);
        onDelta?.(dx, dy, "live");
        eventEmitter?.("move", { position: nextPosition, phase: "live" });
    }, [
        position.z,
        getZoom,
        elementRef,
        onMoving,
        eventEmitter,
        onDelta,
        dragThreshold,
    ]);

    // Registra listeners globais de mousemove e mouseup
    useEffect(() => {
        if (mode === "readonly") return;

        const onUp = (e: MouseEvent) => handleMouseUp(e);
        const onMove = (e: MouseEvent) => handleMouseMove(e);

        document.addEventListener("mouseup", onUp);
        document.addEventListener("mousemove", onMove);

        return () => {
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("mousemove", onMove);
        };
    }, [handleMouseUp, handleMouseMove, mode]);

    return { handleMouseDown, handleMouseUp, moveRef };
}
