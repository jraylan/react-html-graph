import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConnectionContext } from "../context/connection-context";
import useGraphError from "./error";
import useGraphEventBus from "./graph-event-bus";
import useNodeRegistry from "./node-registry";
import { GraphLinkAnchor, GraphNodeRuntimeState } from "../types";
import { buildCursorAnchor, buildLinkAnchor } from "../utils/link-geometry";

interface LinkAnchorsInput {
    id?: string;
    from: { node: string; port: string };
    to?: { node: string; port: string };
    cursorPosition?: { x: number; y: number };
    reportOrphans?: boolean;
}

interface LinkAnchorsSnapshot {
    fromAnchor: GraphLinkAnchor | null;
    toAnchor: GraphLinkAnchor | null;
    fromNodeState: GraphNodeRuntimeState | null;
    toNodeState: GraphNodeRuntimeState | null;
    invalid: boolean;
}


function areAnchorsEqual(left: GraphLinkAnchor | null, right: GraphLinkAnchor | null) {
    if (left === right) return true;
    if (!left || !right) return false;

    return (
        left.x === right.x
        && left.y === right.y
        && left.z === right.z
        && left.d.x === right.d.x
        && left.d.y === right.d.y
    );
}

function areStatesEqual(left: LinkAnchorsSnapshot, right: LinkAnchorsSnapshot) {
    return (
        left.invalid === right.invalid
        && left.fromNodeState === right.fromNodeState
        && left.toNodeState === right.toNodeState
        && areAnchorsEqual(left.fromAnchor, right.fromAnchor)
        && areAnchorsEqual(left.toAnchor, right.toAnchor)
    );
}

/**
 * Resolve as âncoras geométricas de um link sem depender do DOM das portas.
 *
 * A posição nasce do estado runtime do nó combinado com o vetor normalizado
 * declarado na porta. Assim, `link` e `tempLink` compartilham o mesmo contrato
 * e os paths recebem apenas dados geométricos prontos.
 */
export default function useLinkAnchors({
    id,
    from,
    to,
    cursorPosition,
    reportOrphans = false,
}: LinkAnchorsInput) {
    const registry = useNodeRegistry();
    const eventBus = useGraphEventBus();
    const { reportError } = useGraphError();
    const { getPortRegistration, portRegistryVersion } = useContext(ConnectionContext);
    const [snapshot, setSnapshot] = useState<LinkAnchorsSnapshot>({
        fromAnchor: null,
        toAnchor: null,
        fromNodeState: null,
        toNodeState: null,
        invalid: true,
    });
    const liveStateRef = useRef<LinkAnchorsSnapshot>({
        fromAnchor: null,
        toAnchor: null,
        fromNodeState: null,
        toNodeState: null,
        invalid: true,
    });
    const listenersRef = useRef(new Set<(phase?: "live" | "commit") => void>());
    const lastErrorKeyRef = useRef<string | null>(null);
    const canReportOrphansRef = useRef(false);

    const getFromAnchor = useCallback(() => liveStateRef.current.fromAnchor, []);
    const getToAnchor = useCallback(() => liveStateRef.current.toAnchor, []);
    const getFromNodeState = useCallback(() => liveStateRef.current.fromNodeState, []);
    const getToNodeState = useCallback(() => liveStateRef.current.toNodeState, []);
    const subscribePositionChanges = useCallback((listener: (phase?: "live" | "commit") => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    const resolveAnchors = useCallback((phase: "live" | "commit" = "commit") => {
        if (!from.node || !from.port) {
            lastErrorKeyRef.current = null;
            const emptyState: LinkAnchorsSnapshot = {
                fromAnchor: null,
                toAnchor: null,
                fromNodeState: null,
                toNodeState: null,
                invalid: true,
            };
            const changed = !areStatesEqual(liveStateRef.current, emptyState);
            if (changed) {
                liveStateRef.current = emptyState;
                listenersRef.current.forEach(listener => listener(phase));
            }
            if (phase !== "live") {
                setSnapshot(prev => areStatesEqual(prev, emptyState) ? prev : emptyState);
            }
            return;
        }

        const fromNodeState = registry.getNodeState(from.node);
        const toNodeState = to ? registry.getNodeState(to.node) : null;
        const fromPortRegistration = getPortRegistration(from.node, from.port);
        const toPortRegistration = to ? getPortRegistration(to.node, to.port) : null;
        const fromAnchor = buildLinkAnchor(fromNodeState, fromPortRegistration?.location);
        const resolvedToAnchor = buildLinkAnchor(toNodeState, toPortRegistration?.location);
        const toAnchor = resolvedToAnchor ?? buildCursorAnchor(cursorPosition);
        const invalid = !fromAnchor || !toAnchor;

        if (reportOrphans && canReportOrphansRef.current) {
            let nextErrorKey: string | null = null;

            if (!fromNodeState) {
                nextErrorKey = `${id ?? from.node}:${from.node}:node`;
                if (lastErrorKeyRef.current !== nextErrorKey) {
                    reportError("ORPHAN_LINK", `Link "${id ?? from.node}": nó de origem "${from.node}" não encontrado`, {
                        linkId: id ?? from.node,
                        nodeId: from.node,
                    });
                }
            } else if (!fromPortRegistration) {
                nextErrorKey = `${id ?? from.node}:${from.node}:${from.port}:port`;
                if (lastErrorKeyRef.current !== nextErrorKey) {
                    reportError("ORPHAN_LINK", `Link "${id ?? from.node}": porta de origem "${from.node}:${from.port}" não encontrada`, {
                        linkId: id ?? from.node,
                        nodeId: from.node,
                        portId: from.port,
                    });
                }
            } else if (to && !toNodeState && !cursorPosition) {
                nextErrorKey = `${id ?? to.node}:${to.node}:node`;
                if (lastErrorKeyRef.current !== nextErrorKey) {
                    reportError("ORPHAN_LINK", `Link "${id ?? to.node}": nó de destino "${to.node}" não encontrado`, {
                        linkId: id ?? to.node,
                        nodeId: to.node,
                    });
                }
            } else if (to && !toPortRegistration && !cursorPosition) {
                nextErrorKey = `${id ?? to.node}:${to.node}:${to.port}:port`;
                if (lastErrorKeyRef.current !== nextErrorKey) {
                    reportError("ORPHAN_LINK", `Link "${id ?? to.node}": porta de destino "${to.node}:${to.port}" não encontrada`, {
                        linkId: id ?? to.node,
                        nodeId: to.node,
                        portId: to.port,
                    });
                }
            }

            lastErrorKeyRef.current = nextErrorKey;
        }

        const nextState: LinkAnchorsSnapshot = {
            fromAnchor,
            toAnchor,
            fromNodeState,
            toNodeState,
            invalid,
        };

        const changed = !areStatesEqual(liveStateRef.current, nextState);
        if (changed) {
            liveStateRef.current = nextState;
            listenersRef.current.forEach(listener => listener(phase));
        }

        if (phase !== "live") {
            setSnapshot(prev => areStatesEqual(prev, nextState) ? prev : nextState);
        }
    }, [
        cursorPosition,
        from.node,
        from.port,
        getPortRegistration,
        id,
        registry,
        reportError,
        reportOrphans,
        to,
    ]);

    useEffect(() => {
        if (!from.node || !from.port) return;

        canReportOrphansRef.current = false;
        resolveAnchors("commit");

        const frameId = requestAnimationFrame(() => {
            canReportOrphansRef.current = true;
            resolveAnchors("commit");
        });
        const handleMove = (event: { phase?: "live" | "commit" }) => {
            resolveAnchors(event.phase === "live" ? "live" : "commit");
        };

        eventBus.subscribe(from.node, "move", handleMove);
        if (to?.node) {
            eventBus.subscribe(to.node, "move", handleMove);
        }

        return () => {
            canReportOrphansRef.current = false;
            cancelAnimationFrame(frameId);
            eventBus.unsubscribe(from.node, "move", handleMove);
            if (to?.node) {
                eventBus.unsubscribe(to.node, "move", handleMove);
            }
        };
    }, [eventBus, from.node, from.port, portRegistryVersion, resolveAnchors, to?.node]);

    useEffect(() => {
        resolveAnchors("commit");
    }, [resolveAnchors]);

    return {
        ...snapshot,
        getFromAnchor,
        getToAnchor,
        getFromNodeState,
        getToNodeState,
        subscribePositionChanges,
    };
}