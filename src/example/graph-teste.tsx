import { useCallback, useEffect, useRef, useState } from "react";
import Graph from "../graph";
import {
    GraphApplyLayoutInput,
    GraphApi,
    NodeObjectTemplateProps,
    PortRenderProps,
    PortDragEndEvent,
} from "../types";
import BidirectionalPath from "../paths/bidirectional-path";
import useLinkInfo from "../hooks/link-info";
import useGraphApi from "../hooks/use-graph-api";
import { WebWorkerProvider } from "../calculations";
import { GPUProvider, type GPUProviderMode } from "../calculations/gpu-provider";

import MOCK_TEMPLATE from "./mock-template.json"
import UnidirectionalPath from "../paths/unidirectional-path";

type ProviderKind = "webworker" | "gpu";

const PROVIDER_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
    { value: "webworker", label: "Web Worker" },
    { value: "gpu", label: "GPU.js" },
];

const LAYOUTS: Array<{ label: string; algorithm: GraphApplyLayoutInput["algorithm"] }> = [
    { label: "Força direcional", algorithm: "force-direction" },
    { label: "Orgânico", algorithm: "organic" },
    { label: "Radial", algorithm: "radial" },
    { label: "Sequencial", algorithm: "sequential" },
    { label: "Estrutural", algorithm: "structural" },
    { label: "Árvore", algorithm: "tree" },
];

function formatGpuProviderMode(mode: GPUProviderMode | null) {
    switch (mode) {
        case "webgl2":
            return "WebGL2";
        case "webgl":
            return "WebGL";
        case "gpu":
            return "GPU";
        case "cpu":
            return "CPU";
        default:
            return "desconhecido";
    }
}

function formatGpuProviderStatus(provider: GPUProvider) {
    const mode = provider.getExecutionMode();

    if (!mode) {
        return "Provider atual: GPU.js adaptativo; paths leves, labels e layout usam worker. O backend GPU só inicializa quando houver path pesado.";
    }

    if (mode === "cpu") {
        return "Provider atual: GPU.js em fallback CPU; paths leves, labels e layout continuam no worker.";
    }

    return `Provider atual: GPU.js pronto em ${formatGpuProviderMode(mode)} para paths mais pesados; paths leves, labels e layout continuam no worker para proteger o FPS.`;
}

function getLayoutOptions(algorithm: GraphApplyLayoutInput["algorithm"]) {
    switch (algorithm) {
        case "force-direction":
            return {
                padding: 0,
                gapX: 0,
                gapY: 0,
                iterations: 150,
            };
        case "organic":
            return {
                padding: 1,
                gapX: 0,
                gapY: 0,
                iterations: 150,
            };
        case "radial":
            return {
                padding: 56,
                gapX: 36,
                gapY: 36,
                radiusStep: 130,
            };
        case "sequential":
            return {
                padding: 56,
                gapX: 72,
                gapY: 64,
                columns: 4,
            };
        case "structural":
            return {
                padding: 56,
                gapX: 84,
                gapY: 64,
            };
        case "tree":
            return {
                padding: 56,
                gapX: 84,
                gapY: 72,
            };
        default:
            return {
                padding: 56,
            };
    }
}


const COLORS = {
    online: {
        border: '#00cc66',
        badgeBg: '#002a1d',
        badgeClr: '#00ff88',
        badgeTxt: 'ONLINE',
        nameClr: '#aaffbb',
        bg: '#080808',
        separatorClr: '#0a100a',
        infoClr: '#00cc66',
        selectedClr: '#00ff8830',
    },
    offline: {
        border: '#ff3333',
        badgeBg: '#ff3333',
        badgeClr: '#000',
        badgeTxt: 'OFFLINE',
        nameClr: '#ff6666',
        bg: '#060000',
        separatorClr: '#200000',
        infoClr: '#cc3333',
        selectedClr: '#ff333330',
    },
    warning: {
        border: '#ffaa00',
        badgeBg: '#2a1d00',
        badgeClr: '#ffaa00',
        badgeTxt: 'ALERTA',
        nameClr: '#ffcc66',
        bg: '#060600',
        separatorClr: '#0e0e00',
        infoClr: '#ffaa00',
        selectedClr: '#ffaa0030',
    },
    carrier: {
        border: '#1a3322',
        badgeBg: '#0a0a0a',
        badgeClr: '#225533',
        badgeTxt: 'CARRIER',
        nameClr: '#225533',
        bg: '#050505',
        separatorClr: '#090e09',
        infoClr: '#2a5332',
        selectedClr: '#22333330',
    },
    default: {
        border: '#222222',
        badgeBg: '#0a0a0a',
        badgeClr: '#333333',
        badgeTxt: 'UNKNOWN',
        nameClr: '#333333',
        bg: '#050505',
        separatorClr: '#0d0d0d',
        infoClr: '#222222',
        selectedClr: '#33333330',
    },
}

function NodePort(props: PortRenderProps) {
    const isActive = props.isDragging || props.canDrop;

    return (
        <div
            style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: isActive ? "#00ff88" : "#444",
                border: `2px solid ${props.canDrop ? "#00ff88" : props.isDragging ? "#ffaa00" : "#666"}`,
                cursor: props.canDrag ? "crosshair" : "default",
                transition: "background-color 0.15s, border-color 0.15s",
            }}
        />
    );
}

function NodeTemplate({ id, ports, data }: NodeObjectTemplateProps<typeof MOCK_TEMPLATE["nodes"][number]["data"]>) {
    if (!data) return null;
    const colors = COLORS[data.status as keyof typeof COLORS] || COLORS.default;
    return <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            {ports.floating}
        </div>
        <div style={{ position: "absolute", left: "0%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            {ports.left}
        </div>
        <div
            style={{ borderColor: colors.border, backgroundColor: colors.bg }}
        >
            <div>
                <div>
                    <div
                        style={{ backgroundColor: colors.badgeBg, color: colors.badgeClr }}
                    >
                        <span className="-mb-px">
                            {colors.badgeTxt}
                        </span>
                    </div>
                </div>
                <div
                    style={{ color: colors.nameClr }}
                    title={data.label}
                >
                    {data.label}
                </div>
                <span style={{ color: colors.infoClr }}>
                    {data.ip}
                </span>
                <span style={{ color: colors.infoClr }}>
                    {data.model}
                </span>
            </div>
            <div style={{ width: "0.5rem", marginBottom: "0.25rem", backgroundColor: colors.separatorClr }} />
            <div style={{ padding: "0.25rem" }}>
            </div>
        </div>
    </div>
}



/** Contador para gerar IDs únicos para links criados via drag */
let userLinkCounter = 0;

/**
 * Callback de onDragEnd que cria um link entre dois nós quando o arraste
 * termina sobre uma porta válida. Usado para testar conexões interativas.
 */
async function handlePortDragEnd(api: GraphApi, event: PortDragEndEvent) {
    if (!event.targetNodeId || !event.targetPortID) return;

    const linkId = `user-link-${++userLinkCounter}`;
    api.addLink({
        id: linkId,
        connectionType: "ether",
        from: { node: event.sourceNodeId, port: event.sourcePortID },
        to: { node: event.targetNodeId, port: event.targetPortID },
        data: { s: event.sourceNodeId, t: event.targetNodeId, bw: '1G', usage: 10, latency: 50 },
    });
    console.log(`[Conexão] ${event.sourceNodeId}:${event.sourcePortID} -> ${event.targetNodeId}:${event.targetPortID} (${linkId})`);
}


function lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t;
}

function calcularDuracaoAnimacao(ping: number) {
    // Evita divisão por zero e pings negativos
    let p = Math.max(0, ping);

    // Calcula o divisor baseado no crescimento logarítmico
    let divisor = 0.22 * Math.log(p + 1) + 0.25;

    // Duração base = 1.0 (ou o tempo padrão da sua animação)
    let duracao = divisor;

    // CLAMP: Não permite que a animação seja mais rápida que 0.4s
    // nem mais lenta que 1.0s
    return Math.min(duracao, 2.0);
}
function LinkPath({ uni = false, rootRef }: { uni?: boolean, rootRef: React.RefObject<HTMLDivElement> }) {

    const {
        data,
        fromAnchor,
        toAnchor,
        fromNodeState,
        toNodeState,
        getFromAnchor,
        getToAnchor,
        subscribePositionChanges,
    } = useLinkInfo<typeof MOCK_TEMPLATE['links'][number]['data']>()
    if (!data || !fromAnchor || !toAnchor) return null;

    const offline = fromNodeState?.data?.status === "offline" || toNodeState?.data?.status === "offline";
    const color =
        offline
            ? "#ff3333"
            : data.usage > 66 ? "#ff3333" : data.usage > 33 ? "#c7c700" : "#00ff88";
    const bw = parseInt(data.bw.replace("G", "000000000").replace("M", "000000").replace("K", "000"));
    const duration =
        offline
            ? 0
            : calcularDuracaoAnimacao(data.latency);
    const width =
        offline
            ? 1
            : lerp(1, 2, bw / 10000000000);


    if (uni) {
        return (
            <UnidirectionalPath
                from={fromAnchor}
                to={toAnchor}
                rootRef={rootRef}
                liveAnchors={getFromAnchor && getToAnchor && subscribePositionChanges
                    ? {
                        getFrom: getFromAnchor,
                        getTo: getToAnchor,
                        subscribe: subscribePositionChanges,
                    }
                    : undefined
                }
                color={color}
                data={data}
                width={width}
                animationDuration={duration} labels={[
                    { text: data.latency.toFixed(0) + `ms (${duration.toFixed(2)}s)`, position: 0, color: "#fff", fontSize: 14 },
                    { text: data.bw, position: -0.2, color: "#fff", fontSize: 14 },
                    { text: data.usage + '%', position: 0.2, color: "#fff", fontSize: 14 },
                ]}
            />)
    }
    return (
        <BidirectionalPath
            from={fromAnchor}
            to={toAnchor}
            liveAnchors={getFromAnchor && getToAnchor && subscribePositionChanges
                ? {
                    getFrom: getFromAnchor,
                    getTo: getToAnchor,
                    subscribe: subscribePositionChanges,
                }
                : undefined
            }
            rootRef={rootRef}
            data={data}
            width={width}
            spacing={2 * width}
            forwardColor={color}
            reverseColor={color}
            forwardDuration={duration}
            reverseDuration={duration}
            labels={[
                { text: data.latency.toFixed(0) + `ms (${duration.toFixed(2)}s)`, position: 0, color: "#fff", fontSize: 14 },
                { text: data.bw, position: -0.2, color: "#fff", fontSize: 14, textAnchor: "forward" },
                { text: data.usage + '%', position: 0.2, color: "#fff", fontSize: 14, textAnchor: "reverse" },
            ]}
        />
    )
}

function createMockSnapshot() {
    return JSON.parse(JSON.stringify(MOCK_TEMPLATE));
}

export default function GraphTest() {
    const fpsRef = useRef<HTMLSpanElement>(null);
    const fpsCountRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const initialMathProviderRef = useRef(new WebWorkerProvider());
    const [stateSummary, setStateSummary] = useState("Nós: 0 | Links: 0");
    const [serializedGraph, setSerializedGraph] = useState("");
    const [serializationStatus, setSerializationStatus] = useState("Use os botões abaixo para serializar ou restaurar o snapshot do grafo.");
    const [providerKind, setProviderKind] = useState<ProviderKind>("webworker");
    const [providerStatus, setProviderStatus] = useState("Provider atual: Web Worker.");

    const graphApi = useGraphApi({
        mathProvider: initialMathProviderRef.current,
        onReady: async (api) => {
            handleLoadMockSnapshot();
            api.setDefaultNodeTemplate(NodeTemplate);
            api.registerNodeType(
                "router",
                {
                    ports: [
                        {
                            id: "port",
                            connectionType: "data",
                            direction: "bidirectional",
                            location: { x: 0, y: 0 },
                            children: NodePort,
                            onDragEnd: handlePortDragEnd,
                        },
                    ],
                }
            );
            api.registerNodeType(
                "switch",
                {
                    ports: [
                        {
                            id: "port",
                            connectionType: "data",
                            direction: "bidirectional",
                            location: "left",
                            children: NodePort,
                            onDragEnd: handlePortDragEnd,
                        },
                    ],
                    template: NodeTemplate // Optional se tiver defaultNodeTemplate
                }
            );
            api.registerNodeType(
                "cloud",
                {
                    ports: [
                        {
                            id: "port",
                            connectionType: "data",
                            direction: "bidirectional",
                            location: { x: 0, y: 0 },
                            children: NodePort,
                            onDragEnd: handlePortDragEnd,
                        },
                    ],
                    template: NodeTemplate
                }
            );
            api.setDefaultLinkTemplate(({ rootRef }) => <LinkPath rootRef={rootRef} />);
            api.registerLinkTemplate("ftth", ({ rootRef }) => <LinkPath rootRef={rootRef} uni />);
            api.registerLinkTemplate("ether", ({ rootRef }) => <LinkPath rootRef={rootRef} />);

            const snapshot = createMockSnapshot();
            api.load(snapshot);
        },
        onLoad: async (api) => {
            await api.centralize({ padding: 48 });
        }
        // defaultNodeTemplate: (props) => <NodeTemplate {...props} />, // Optional
        // defaultLinkTemplate: (props) => <LinkPath {...props} />, // Optional
    });

    const handleProviderChange = useCallback(async (nextProviderKind: ProviderKind) => {
        if (nextProviderKind === providerKind) {
            return;
        }

        const nextProvider = nextProviderKind === "gpu"
            ? new GPUProvider()
            : new WebWorkerProvider();

        const nextProviderStatus = nextProvider instanceof GPUProvider
            ? formatGpuProviderStatus(nextProvider)
            : "Provider atual: Web Worker.";

        await graphApi.setMathProvider(nextProvider);
        setProviderKind(nextProviderKind);
        setProviderStatus(nextProviderStatus);
    }, [graphApi, providerKind]);

    const updateStateSummary = useCallback(() => {
        const api = graphApi;
        if (!api) return;
        const nodes = api.getNodeStates();
        const links = api.getLinkStates();
        setStateSummary(`Nós: ${nodes.length} | Links: ${links.length}`);
    }, [graphApi]);

    const handleCentralize = useCallback(async () => {
        const api = graphApi;
        if (!api) return;
        await api.centralize({ padding: 48 });
        updateStateSummary();
    }, [graphApi, updateStateSummary]);

    const handleApplyLayout = useCallback(async (algorithm: GraphApplyLayoutInput["algorithm"]) => {
        const api = graphApi;
        if (!api) return;
        await api.applyLayout({
            algorithm,
            options: getLayoutOptions(algorithm),
        });
        await api.centralize({ padding: 40 });
        updateStateSummary();
    }, [graphApi, updateStateSummary]);

    const handleLoadMockSnapshot = useCallback(async () => {
        const api = graphApi;
        if (!api) return;

        const snapshot = createMockSnapshot();
        api.load(snapshot);
        setSerializedGraph(JSON.stringify(snapshot, null, 2));
        setSerializationStatus("Snapshot de exemplo restaurado via load().");
        await api.centralize({ padding: 48 });
        updateStateSummary();
    }, [graphApi, updateStateSummary]);

    const handleSerialize = useCallback(() => {
        const api = graphApi;
        if (!api) return;

        const snapshot = api.serialize();
        setSerializedGraph(JSON.stringify(snapshot, null, 2));
        setSerializationStatus(`Snapshot serializado com ${snapshot.nodes.length} nós e ${snapshot.links.length} links.`);
        updateStateSummary();
    }, [graphApi, updateStateSummary]);

    const handleload = useCallback(async () => {
        const api = graphApi;
        if (!api) return;

        if (!serializedGraph.trim()) {
            setSerializationStatus("Cole ou gere um JSON antes de desserializar o snapshot.");
            return;
        }

        try {
            api.load(serializedGraph);
            setSerializationStatus("Snapshot restaurado a partir do JSON informado.");
            await api.centralize({ padding: 48 });
            updateStateSummary();
        } catch (error) {
            setSerializationStatus(error instanceof Error ? error.message : "Não foi possível desserializar o snapshot informado.");
        }
    }, [graphApi, serializedGraph, updateStateSummary]);

    useEffect(() => {
        let running = true;
        function calculateFPS(td: number) {
            if (!running) return;
            if (!lastTimeRef.current)
                lastTimeRef.current = performance.now();
            fpsCountRef.current += 1
            requestAnimationFrame(calculateFPS);
        }
        requestAnimationFrame(calculateFPS);
        let interval = window.setInterval(() => {
            const now = performance.now();
            const delta = now - lastTimeRef.current;
            const fps = ((fpsCountRef.current / delta) * 1000);
            if (fpsRef.current) {
                fpsRef.current.textContent = `FPS: ${fps.toFixed(0)}`;
            }
            fpsCountRef.current = 0;
            lastTimeRef.current = now;
        }, 500);
        return () => {
            running = false;
            window.clearInterval(interval);
        }

    }, [])

    return (
        <>
            <div className="graph-test-container">
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#aaa", padding: "0.75rem", borderBottom: "1px solid #1a1a1a", backgroundColor: "#050505" }}>
                    <span ref={fpsRef} />
                    <span>{stateSummary}</span>
                    <div style={{ flex: 1, width: "0px" }} />
                    <span style={{ color: "#8ab4f8" }}>{providerStatus}</span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        <span>Provider:</span>
                        <select
                            value={providerKind}
                            onChange={(event) => void handleProviderChange(event.target.value as ProviderKind)}
                            style={{
                                border: "1px solid #1f1f1f",
                                borderRadius: "0.35rem",
                                backgroundColor: "#0a0a0a",
                                color: "#d7d7d7",
                                padding: "0.25rem 0.5rem",
                            }}
                        >
                            {PROVIDER_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#aaa", padding: "0.75rem", borderBottom: "1px solid #1a1a1a", backgroundColor: "#050505" }}>
                    <button onClick={() => handleCentralize()}>Centralizar</button>
                    <button onClick={updateStateSummary}>Ler estado</button>
                    <button onClick={handleSerialize}>Serializar</button>
                    <button onClick={() => void handleload()}>Desserializar</button>
                    <button onClick={() => void handleLoadMockSnapshot()}>Restaurar demo</button>
                    {LAYOUTS.map(layout => (
                        <button key={layout.algorithm.toString()} onClick={() => void handleApplyLayout(layout.algorithm)}>
                            {layout.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderBottom: "1px solid #1a1a1a", backgroundColor: "#070707" }}>
                    <textarea
                        value={serializedGraph}
                        onChange={(event) => setSerializedGraph(event.target.value)}
                        rows={10}
                        spellCheck={false}
                        placeholder="O JSON serializado do grafo aparecerá aqui..."
                        style={{
                            width: "100%",
                            resize: "vertical",
                            border: "1px solid #1f1f1f",
                            borderRadius: "0.5rem",
                            backgroundColor: "#030303",
                            color: "#d7d7d7",
                            padding: "0.75rem",
                            fontSize: "0.75rem",
                            lineHeight: 1.4,
                            fontFamily: "Consolas, 'Courier New', monospace",
                            boxSizing: "border-box",
                        }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "#8ab4f8" }}>{serializationStatus}</span>
                </div>
                <div className="graph-test-graph">
                    <Graph
                        api={graphApi}
                        mode="edit"
                        onError={(err) => console.error("[GraphError]", err)}
                    />
                </div>
            </div>
        </>
    );
}