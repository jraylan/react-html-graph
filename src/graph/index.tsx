import React, {
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";

import { Viewbox, GraphProps, GraphError, GraphApi, NodeDefinition, LinkDefinition } from "../types";
import { GraphContext } from "../context/graph-context";
import { ErrorContext } from "../context/error-context";
import { ConnectionContext } from "../context/connection-context";
import { GraphRootContext } from "../context/graph-root-context";
import ConnectionProvider from "../providers/connection-provider";
import GraphObject from "../nodes/base";
import GraphLink from "../link/base";
import ViewBox from "./viewbox";
import "../style.css";

type PanState = {
    panning: boolean,
    panPointStart: { x: number, y: number }
}



/**
 * Componente Graph que orquestra o contexto do grafo, providers e o viewbox.
 * Recebe chamadas imperativas via ref (GraphApi) expostas por GraphHandle.
 *
 * @param props Propriedades do componente Graph
 * @returns JSX.Element
 */
export default function Graph({ ref, mode = "edit", onError }: GraphProps) {
    const rootRef = useRef<HTMLElement>(null)
    const graphApiRef = useRef<GraphApi>(null);
    const [nodeDefs, setNodeDefs] = useState<NodeDefinition[]>([]);
    const [linkDefs, setLinkDefs] = useState<LinkDefinition[]>([]);
    const [viewbox, setViewBox] = useState<Viewbox>({
        x: 0, y: 0, zoom: 1, width: 0, height: 0,
    })

    // Converte definicoes em React elements para GraphContext
    const nodes = useMemo(() =>
        nodeDefs.map(def => (
            <GraphObject
                key={def.id}
                id={def.id}
                ports={def.ports}
                data={def.data}
                initialPosition={def.position}
            >
                {def.template}
            </GraphObject>
        )),
        [nodeDefs]
    );

    const links = useMemo(() =>
        linkDefs.map(def => (
            <GraphLink key={def.id} {...def} />
        )),
        [linkDefs]
    );

    const panRef = useRef<PanState>({
        panning: false,
        panPointStart: { x: 0, y: 0 }
    })

    const handleError = useCallback((error: GraphError) => {
        onError?.(error);
    }, [onError]);

    const handleMouseDown = useCallback((ev: React.MouseEvent<HTMLDivElement>) => {
        if (ev.button !== 1 || !rootRef.current) return;
        panRef.current.panning = true
        rootRef.current.style.userSelect = 'none'

    }, []);
    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (panRef.current.panning && rootRef.current && e.button === 1) {
            panRef.current.panning = false
            rootRef.current.style.userSelect = ""
        }
    }, []);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const root = rootRef.current ?? (e.target as HTMLElement);
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const delta = -e.deltaY;

        setViewBox(vb => {
            const MIN_ZOOM = 0.1;
            const MAX_ZOOM = 2;
            const FACTOR = 1.2;

            const newZoom = delta > 0 ? Math.min(MAX_ZOOM, vb.zoom * FACTOR) : Math.max(MIN_ZOOM, vb.zoom / FACTOR);
            if (newZoom === vb.zoom) return vb;

            const worldX = offsetX / vb.zoom + vb.x;
            const worldY = offsetY / vb.zoom + vb.y;

            const x = worldX - offsetX / newZoom;
            const y = worldY - offsetY / newZoom;

            return { ...vb, x, y, zoom: newZoom }
        })
    }, [])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!panRef.current.panning) return;
        setViewBox(vb => {
            return {
                ...vb,
                x: vb.x - e.movementX / vb.zoom,
                y: vb.y - e.movementY / vb.zoom,
            }
        })
    }, []);


    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        function checkDimension() {
            setViewBox(vb => {
                if (!el) return vb;
                return {
                    ...vb,
                    width: el.clientWidth,
                    height: el.clientHeight,
                }
            })
        }

        el.addEventListener('wheel', handleWheel, { passive: false })

        checkDimension();
        const observer = new ResizeObserver(checkDimension)
        observer.observe(el)
        return () => {
            el.removeEventListener('wheel', handleWheel as EventListener)
            observer.disconnect();
        }

    }, [handleWheel])


    // Valida IDs duplicados entre nós e links
    useEffect(() => {
        const ids = new Map<string, string[]>();

        for (const def of nodeDefs) {
            if (!ids.has(def.id)) ids.set(def.id, []);
            ids.get(def.id)!.push("node");
        }

        for (const def of linkDefs) {
            if (!ids.has(def.id)) ids.set(def.id, []);
            ids.get(def.id)!.push("link");
        }

        for (const [id, types] of ids) {
            if (types.length > 1) {
                handleError({
                    code: "DUPLICATE_ID",
                    message: `Duplicate id "${id}" found across: ${types.join(", ")}`,
                    details: { id, types },
                });
            }
        }
    }, [nodeDefs, linkDefs, handleError]);

    return (
        <ErrorContext.Provider value={{ reportError: handleError }}>
            <GraphContext.Provider value={{
                viewbox,
                nodes,
                links,
                mode,
            }}>
                <GraphRootContext.Provider value={rootRef}>
                    <ConnectionProvider graphApiRef={graphApiRef}>
                        <GraphHandle ref={ref} graphApiRef={graphApiRef} setNodeDefs={setNodeDefs} setLinkDefs={setLinkDefs} />
                        <graph-root
                            ref={rootRef}
                            onMouseDown={handleMouseDown}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
                            <ViewBox />
                        </graph-root>
                    </ConnectionProvider>
                </GraphRootContext.Provider>
            </GraphContext.Provider>
        </ErrorContext.Provider>
    );
}



/**
 * Componente auxiliar que implementa a API imperativa do Graph (GraphApi)
 * e a expõe através da ref fornecida pelo componente pai.
 *
 * Esta função não renderiza nada (retorna null) e serve apenas para vincular
 * handlers/estado ao objeto de API.
 */
function GraphHandle({ ref, graphApiRef, setNodeDefs, setLinkDefs }: {
    ref?: React.Ref<GraphApi>;
    graphApiRef: React.RefObject<GraphApi | null>;
    setNodeDefs: React.Dispatch<React.SetStateAction<NodeDefinition[]>>;
    setLinkDefs: React.Dispatch<React.SetStateAction<LinkDefinition[]>>;
}) {
    const { connect, disconnect, connections } = useContext(ConnectionContext);

    useImperativeHandle(ref, () => {
        const api: GraphApi = {
            addNode: (node: NodeDefinition) => setNodeDefs(prev => [...prev, node]),
            removeNode: (id: string) => setNodeDefs(prev => prev.filter(n => n.id !== id)),
            addLink: (link: LinkDefinition) => setLinkDefs(prev => [...prev, link]),
            removeLink: (id: string) => setLinkDefs(prev => prev.filter(l => l.id !== id)),
            connect,
            disconnect,
            getConnections: () => connections,
        };
        (graphApiRef as React.MutableRefObject<GraphApi | null>).current = api;
        return api;
    }, [connect, disconnect, connections, setNodeDefs, setLinkDefs, graphApiRef]);

    return null;
}