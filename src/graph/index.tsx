import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Viewbox,
    GraphProps,
    GraphError,
    GraphApi,
    NodeDefinition,
    LinkDefinition,
    GraphApplyLayoutInput,
    GraphCentralizeOptions,
    GraphLayoutInput,
    GraphLayoutLink,
    GraphLayoutNode,
    GraphLayoutResult,
    GraphLinkRuntimeState,
    GraphNodeRuntimeState,
    LinkInfoContextValue,
} from "../types";
import { GraphApiInternal, GraphApiBindings } from "../hooks/use-graph-api";
import { calculateFitView } from "../calculations";
import { GraphContext } from "../context/graph-context";
import { ErrorContext } from "../context/error-context";
import { ConnectionContext } from "../context/connection-context";
import { GraphRootContext } from "../context/graph-root-context";
import ConnectionProvider from "../providers/connection-provider";
import NodeRegistryProvider from "../providers/node-registry-provider";
import GraphEventBusProvider from "../providers/graph-event-bus-provider";
import { GRAPH_LAYOUT_EXECUTORS } from "../layouts";
import GraphObject from "../nodes/base";
import GraphLink from "../link/base";
import ViewBox from "./viewbox";
import "../style.css";

type PanState = {
    panning: boolean,
    panPointStart: { x: number, y: number }
}

type GraphSnapshot = {
    nodes: GraphLayoutNode[];
    links: GraphLayoutLink[];
    bounds: { left: number; top: number; width: number; height: number };
}


function getSnapshotBounds(nodes: GraphLayoutNode[]) {
    if (nodes.length === 0) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const node of nodes) {
        left = Math.min(left, node.position.x);
        top = Math.min(top, node.position.y);
        right = Math.max(right, node.position.x + node.width);
        bottom = Math.max(bottom, node.position.y + node.height);
    }

    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}



/**
 * Componente Graph que orquestra o contexto do grafo, providers e o viewbox.
 * Recebe a API estável criada por useGraphApi via prop `api`.
 *
 * @param props Propriedades do componente Graph
 * @returns JSX.Element
 */
export default function Graph({ api, mode = "edit", onError }: GraphProps) {
    const rootRef = useRef<HTMLElement>(null)
    const internal = api as GraphApiInternal;
    const [nodeDefs, setNodeDefs] = useState<NodeDefinition[]>([]);
    const [linkDefs, setLinkDefs] = useState<LinkDefinition[]>([]);
    const [viewbox, setViewBoxState] = useState<Viewbox>({
        x: 0, y: 0, zoom: 1, width: 0, height: 0,
    })
    const viewboxRef = useRef<Viewbox>(viewbox)
    const nodeStateRef = useRef<Map<string, GraphNodeRuntimeState>>(new Map());
    const linkStateRef = useRef<Map<string, GraphLinkRuntimeState>>(new Map());

    // Wrapper que mantém ref e state sempre sincronizados.
    // A ref é a fonte de verdade; updaters leem dela (não do state batched).
    const setViewBox = useCallback((updater: Viewbox | ((prev: Viewbox) => Viewbox)) => {
        const newVb = typeof updater === 'function' ? updater(viewboxRef.current) : updater;
        viewboxRef.current = newVb;
        setViewBoxState(newVb);
    }, []);

    const handleNodeStateChange = useCallback((state: GraphNodeRuntimeState) => {
        nodeStateRef.current.set(state.id, state);
    }, []);

    const handleLinkStateChange = useCallback((state: GraphLinkRuntimeState) => {
        linkStateRef.current.set(state.id, state);
    }, []);

    // Atualiza apenas a ref de estado (sem setNodeDefs) para evitar re-render de todos os nós.
    const handleNodeMove = useCallback((nodeId: string, newPosition: GraphNodeRuntimeState["position"]) => {
        const current = nodeStateRef.current.get(nodeId);
        nodeStateRef.current.set(nodeId, {
            id: nodeId,
            position: newPosition,
            width: current?.width ?? 1,
            height: current?.height ?? 1,
            data: current?.data,
        });
    }, [nodeStateRef]);

    // Resolve nodeType do registro para obter portas e template
    const nodes = useMemo(() =>
        nodeDefs.map(def => {
            const nodeType = internal._nodeTypeRegistry.get(def.nodeType);
            const template = nodeType?.template ?? internal._defaultNodeTemplate;
            const ports = nodeType?.ports ?? [];

            if (!template) return null;

            return (
                <GraphObject
                    key={def.id}
                    id={def.id}
                    position={def.position}
                    ports={ports}
                    data={def.data}
                    initialPosition={def.position}
                    onMove={(newPosition) => handleNodeMove(def.id, newPosition)}
                    onStateChange={handleNodeStateChange}
                >
                    {template}
                </GraphObject>
            );
        }),
        [handleNodeMove, handleNodeStateChange, nodeDefs, internal._nodeTypeRegistry, internal._defaultNodeTemplate]
    );

    // Resolve template do registro por connectionType
    const links = useMemo(() =>
        linkDefs.map(def => {
            const template: ((props: LinkInfoContextValue) => React.ReactNode) | undefined =
                (def.connectionType
                    ? internal._linkTemplateRegistry.get(def.connectionType)
                    : undefined)
                ?? internal._defaultLinkTemplate
                ?? undefined;

            if (!template) return null;

            return (
                <GraphLink key={def.id} id={def.id} from={def.from} to={def.to} data={def.data} template={template} onStateChange={handleLinkStateChange} />
            );
        }),
        [handleLinkStateChange, linkDefs, internal._linkTemplateRegistry, internal._defaultLinkTemplate]
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
            // Commita a posição acumulada no ref para o React state
            setViewBox(viewboxRef.current);
        }
    }, [setViewBox]);

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
    }, [setViewBox])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!panRef.current.panning) return;
        const vb = viewboxRef.current;
        const newX = vb.x - e.movementX / vb.zoom;
        const newY = vb.y - e.movementY / vb.zoom;
        viewboxRef.current = { ...vb, x: newX, y: newY };

        // Atualiza o DOM diretamente sem causar re-render
        const viewboxEl = rootRef.current?.querySelector('graph-viewbox') as HTMLElement | null;
        if (viewboxEl) {
            viewboxEl.style.transform = `scale(${vb.zoom}) translate(${-newX}px, ${-newY}px)`;
            viewboxEl.style.transformOrigin = '0 0';
        }
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

    }, [handleWheel, setViewBox])


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

    useEffect(() => {
        const validIds = new Set(nodeDefs.map(def => def.id));
        for (const id of [...nodeStateRef.current.keys()]) {
            if (!validIds.has(id)) {
                nodeStateRef.current.delete(id);
            }
        }
    }, [nodeDefs]);

    useEffect(() => {
        const validIds = new Set(linkDefs.map(def => def.id));
        for (const id of [...linkStateRef.current.keys()]) {
            if (!validIds.has(id)) {
                linkStateRef.current.delete(id);
            }
        }
    }, [linkDefs]);

    return (
        <ErrorContext.Provider value={{ reportError: handleError }}>
            <GraphContext.Provider value={{
                viewbox,
                nodes,
                links,
                mode,
            }}>
                <GraphRootContext.Provider value={rootRef}>
                    <NodeRegistryProvider>
                        <GraphEventBusProvider>
                            <ConnectionProvider graphApi={api}>
                                <GraphHandle
                                    api={api}
                                    rootRef={rootRef}
                                    nodeDefs={nodeDefs}
                                    linkDefs={linkDefs}
                                    nodeStateRef={nodeStateRef}
                                    linkStateRef={linkStateRef}
                                    mode={mode}
                                    viewboxRef={viewboxRef}
                                    setViewBox={setViewBox}
                                    setNodeDefs={setNodeDefs}
                                    setLinkDefs={setLinkDefs}
                                />
                                <graph-root
                                    ref={rootRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseUp={handleMouseUp}
                                    onMouseMove={handleMouseMove}
                                >
                                    <ViewBox />
                                </graph-root>
                            </ConnectionProvider>
                        </GraphEventBusProvider>
                    </NodeRegistryProvider>
                </GraphRootContext.Provider>
            </GraphContext.Provider>
        </ErrorContext.Provider>
    );
}



/**
 * Componente auxiliar que conecta a API imperativa do Graph (GraphApi)
 * ao objeto estável criado por useGraphApi via _bind/_unbind.
 *
 * Não renderiza nada (retorna null).
 */
function GraphHandle({
    api,
    rootRef,
    nodeDefs,
    linkDefs,
    nodeStateRef,
    linkStateRef,
    mode,
    viewboxRef,
    setViewBox,
    setNodeDefs,
    setLinkDefs,
}: {
    api: GraphApi;
    rootRef: React.RefObject<HTMLElement | null>;
    nodeDefs: NodeDefinition[];
    linkDefs: LinkDefinition[];
    nodeStateRef: React.RefObject<Map<string, GraphNodeRuntimeState>>;
    linkStateRef: React.RefObject<Map<string, GraphLinkRuntimeState>>;
    mode: GraphProps["mode"];
    viewboxRef: React.RefObject<Viewbox>;
    setViewBox: (updater: Viewbox | ((prev: Viewbox) => Viewbox)) => void;
    setNodeDefs: React.Dispatch<React.SetStateAction<NodeDefinition[]>>;
    setLinkDefs: React.Dispatch<React.SetStateAction<LinkDefinition[]>>;
}) {
    const { connect, disconnect, connections } = useContext(ConnectionContext);

    const buildSnapshot = useCallback((): GraphSnapshot => {
        const nodes: GraphLayoutNode[] = nodeDefs.map(def => {
            const runtimeState = nodeStateRef.current.get(def.id);
            return {
                id: def.id,
                width: Math.max(1, runtimeState?.width ?? 1),
                height: Math.max(1, runtimeState?.height ?? 1),
                position: runtimeState?.position ?? def.position,
                data: def.data,
            };
        });

        const links: GraphLayoutLink[] = linkDefs.map(def => ({
            id: def.id,
            from: def.from.node,
            to: def.to.node,
            data: def.data,
        }));

        return {
            nodes,
            links,
            bounds: getSnapshotBounds(nodes),
        };
    }, [linkDefs, nodeDefs, nodeStateRef]);

    const applyPositions = useCallback((result: GraphLayoutResult) => {
        for (const item of result.positions) {
            const currentState = nodeStateRef.current.get(item.id);
            nodeStateRef.current.set(item.id, {
                id: item.id,
                position: item.position,
                width: currentState?.width ?? 1,
                height: currentState?.height ?? 1,
                data: currentState?.data,
            });
        }

        setNodeDefs(prev => {
            const positionMap = new Map(result.positions.map(item => [item.id, item.position]));
            let changed = false;

            const next = prev.map(def => {
                const newPosition = positionMap.get(def.id);
                if (!newPosition) return def;
                if (
                    def.position.x === newPosition.x &&
                    def.position.y === newPosition.y &&
                    def.position.z === newPosition.z
                ) {
                    return def;
                }
                changed = true;
                return {
                    ...def,
                    position: newPosition,
                };
            });

            return changed ? next : prev;
        });
    }, [nodeStateRef, setNodeDefs]);

    const centralize = useCallback(async (options?: GraphCentralizeOptions) => {
        const snapshot = buildSnapshot();
        const root = rootRef.current;
        const viewportWidth = root?.clientWidth ?? viewboxRef.current.width;
        const viewportHeight = root?.clientHeight ?? viewboxRef.current.height;
        const fitResult = await calculateFitView({
            nodes: snapshot.nodes.map(node => ({
                id: node.id,
                width: node.width,
                height: node.height,
                x: node.position.x,
                y: node.position.y,
                z: node.position.z,
            })),
            viewportWidth,
            viewportHeight,
            padding: options?.padding ?? 32,
            minZoom: options?.minZoom ?? 0.1,
            maxZoom: options?.maxZoom ?? 2,
        });

        const nextViewbox = {
            ...viewboxRef.current,
            x: fitResult.x,
            y: fitResult.y,
            zoom: fitResult.zoom,
            width: viewportWidth,
            height: viewportHeight,
        };
        setViewBox(nextViewbox);
        return nextViewbox;
    }, [buildSnapshot, rootRef, setViewBox, viewboxRef]);

    const applyLayout = useCallback(async (input: GraphApplyLayoutInput) => {
        const snapshot = buildSnapshot();
        const root = rootRef.current;
        const viewport = {
            width: root?.clientWidth ?? viewboxRef.current.width,
            height: root?.clientHeight ?? viewboxRef.current.height,
        };
        if (mode === "readonly") {
            return {
                positions: snapshot.nodes.map(node => ({
                    id: node.id,
                    position: node.position,
                })),
                bounds: snapshot.bounds,
            } satisfies GraphLayoutResult;
        }

        const executor = GRAPH_LAYOUT_EXECUTORS[input.algorithm];
        const layoutInput: GraphLayoutInput = {
            nodes: snapshot.nodes,
            links: snapshot.links,
            options: {
                ...input.options,
                viewport,
            },
        };
        const result = await executor(layoutInput);
        applyPositions(result);
        return result;
    }, [applyPositions, buildSnapshot, mode, rootRef, viewboxRef]);

    // Ref que sempre aponta para as closures mais recentes
    const implRef = useRef<GraphApiBindings>({
        addNode: () => {},
        removeNode: () => {},
        addLink: () => {},
        removeLink: () => {},
        connect: () => {},
        disconnect: () => {},
        getConnections: () => [],
        getNodeStates: () => [],
        getLinkStates: () => [],
        centralize: () => Promise.resolve({} as Viewbox),
        applyLayout: () => Promise.resolve({} as GraphLayoutResult),
    });

    // Atualiza a ref a cada render para capturar closures atualizadas
    implRef.current = {
        addNode: (node: NodeDefinition) => setNodeDefs(prev => [...prev, node]),
        removeNode: (id: string) => setNodeDefs(prev => prev.filter(n => n.id !== id)),
        addLink: (link: LinkDefinition) => setLinkDefs(prev => [...prev, link]),
        removeLink: (id: string) => setLinkDefs(prev => prev.filter(l => l.id !== id)),
        connect,
        disconnect,
        getConnections: () => connections,
        getNodeStates: () => Array.from(nodeStateRef.current.values()),
        getLinkStates: () => Array.from(linkStateRef.current.values()),
        centralize,
        applyLayout,
    };

    // Bind único — delega via implRef para closures sempre atualizadas
    useEffect(() => {
        const internal = api as GraphApiInternal;
        internal._bind({
            addNode: (...args) => implRef.current.addNode(...args),
            removeNode: (...args) => implRef.current.removeNode(...args),
            addLink: (...args) => implRef.current.addLink(...args),
            removeLink: (...args) => implRef.current.removeLink(...args),
            connect: (...args) => implRef.current.connect(...args),
            disconnect: (...args) => implRef.current.disconnect(...args),
            getConnections: () => implRef.current.getConnections(),
            getNodeStates: () => implRef.current.getNodeStates(),
            getLinkStates: () => implRef.current.getLinkStates(),
            centralize: (...args) => implRef.current.centralize(...args),
            applyLayout: (...args) => implRef.current.applyLayout(...args),
        });
        return () => internal._unbind();
    }, [api]);

    return null;
}
