import { useCallback, useEffect, useRef, useState } from "react";
import Graph from "../graph";
import {
    GraphApplyLayoutInput,
    GraphApi,
    GraphSerializedState,
    LinkDefinition,
    NodeObjectTemplateProps,
    NodeDefinition,
    PortRenderProps,
    PortDragEndEvent,
} from "../types";
import BidirectionalPath from "../paths/bidirectional-path";
import useLinkInfo from "../hooks/link-info";
import useGraphApi from "../hooks/use-graph-api";


const MOCK_DEVICES = [
    { id: 'pe01', label: '01 PE01-BSB-CORE', type: 'router', model: 'Huawei_router', ip: '10.99.99.1', status: 'online', uptime: '287d 4h', x: 480, y: 300 },
    { id: 'pe02', label: '02 PE02-BSB-CORE', type: 'router', model: 'Huawei_router', ip: '10.99.99.2', status: 'online', uptime: '102d 7h', x: 700, y: 460 },
    { id: 'pe03', label: '03 PE03-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.3', status: 'online', uptime: '55d 3h', x: 700, y: 140 },
    { id: 'pe04', label: '04 PE04-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.4', status: 'offline', uptime: '—', x: 240, y: 140 },
    { id: 'pe05', label: '05 PE05-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.5', status: 'online', uptime: '14d 2h', x: 320, y: 60 },
    { id: 'pe06', label: '06 PE06-BSB-CORE', type: 'switch', model: 'Cisco_switch', ip: '10.99.99.6', status: 'warning', uptime: '1d 5h', x: 680, y: 60 },
    { id: 'pe07', label: '07 PE07-BSB-CORE', type: 'switch', model: 'Cisco_switch', ip: '10.99.99.7', status: 'online', uptime: '60d 11h', x: 860, y: 280 },
    { id: 'pe08', label: '08 PE08-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.8', status: 'online', uptime: '90d 6h', x: 520, y: 500 },
    { id: 'pe09', label: '09 PE09-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.9', status: 'online', uptime: '33d 2h', x: 760, y: 560 },
    { id: 'pe10', label: '10 PE10-BSB-CORE', type: 'switch', model: 'Huawei_switch', ip: '10.99.99.10', status: 'online', uptime: '48d 9h', x: 240, y: 440 },
    { id: 'pna', label: 'PNA/META', type: 'cloud', model: 'Carrier', ip: '—', status: 'carrier', uptime: '—', x: 400, y: 370 },
    { id: 'l3', label: 'LEVEL 3_10G8', type: 'cloud', model: 'Carrier', ip: '—', status: 'carrier', uptime: '—', x: 400, y: 460 },
    { id: 'l33', label: 'LEVEL 3_10G8', type: 'cloud', model: 'Carrier', ip: '—', status: 'unknown', uptime: '—', x: 500, y: 560 },
];

const MOCK_LINKS = [
    { s: 'pe01', t: 'pna', type: "ftth", bw: '10G', usage: 55, latency: 1 },
    { s: 'pe01', t: 'l3', type: "ftth", bw: '10G', usage: 40, latency: 12 },
    { s: 'pe01', t: 'pe05', type: "ether", bw: '1G', usage: 72, latency: 13 },
    { s: 'pe02', t: 'pe06', type: "ether", bw: '1G', usage: 30, latency: 43 },
    { s: 'pe02', t: 'pe07', type: "ether", bw: '1G', usage: 60, latency: 123 },
    { s: 'pe01', t: 'pe02', type: "ether", bw: '1G', usage: 45, latency: 223 },
    { s: 'pe01', t: 'pe08', type: "ether", bw: '1G', usage: 20, latency: 14 },
    { s: 'pe01', t: 'pe03', type: "ether", bw: '1G', usage: 35, latency: 33 },
    { s: 'pe03', t: 'pe04', type: "ether", bw: '1G', usage: 0, latency: 9999 },
    { s: 'pe04', t: 'pe09', type: "ether", bw: '1G', usage: 50, latency: 9999 },
    { s: 'pe01', t: 'pe10', type: "ether", bw: '1G', usage: 25, latency: 123 },
];

const LAYOUTS: Array<{ label: string; algorithm: GraphApplyLayoutInput["algorithm"] }> = [
    { label: "Força direcional", algorithm: "force-direction" },
    { label: "Orgânico", algorithm: "organic" },
    { label: "Radial", algorithm: "radial" },
    { label: "Sequencial", algorithm: "sequential" },
    { label: "Estrutural", algorithm: "structural" },
    { label: "Árvore", algorithm: "tree" },
];

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

function NodeTemplate({ id, ports, data }: NodeObjectTemplateProps<typeof MOCK_DEVICES[number]>) {
    if (!data) return null;
    const colors = COLORS[data.status as keyof typeof COLORS] || COLORS.default;
    return <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            {ports.all}
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
    if (!event.targetNodeId || !event.targetPortName) return;

    const linkId = `user-link-${++userLinkCounter}`;
    api.addLink({
        id: linkId,
        connectionType: "ether",
        from: { node: event.sourceNodeId, port: event.sourcePortName },
        to: { node: event.targetNodeId, port: event.targetPortName },
        data: { s: event.sourceNodeId, t: event.targetNodeId, bw: '1G', usage: 10, latency: 50 },
    });
    console.log(`[Conexão] ${event.sourceNodeId}:${event.sourcePortName} -> ${event.targetNodeId}:${event.targetPortName} (${linkId})`);
}

function createNode(data: typeof MOCK_DEVICES[number]): NodeDefinition {
    const { id, x, y } = data;
    return ({
        id: id,
        nodeType: data.type,
        position: { x: x, y: y, z: 0 },
        data,
    });
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
function LinkPath() {

    const { data } = useLinkInfo<typeof MOCK_LINKS[number]>()

    const offline = MOCK_DEVICES.some(d => (d.id === data.s || d.id === data.t) && d.status === "offline");
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


    return (

        <BidirectionalPath
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

function createLink(data: typeof MOCK_LINKS[number]): LinkDefinition {

    return {
        id: `link-${data.s}-${data.t}`,
        connectionType: data.type,
        from: {
            node: data.s,
            port: "port",
        },
        to: {
            node: data.t,
            port: "port",
        },
        data,
    };
}

function createMockSnapshot(): GraphSerializedState<typeof MOCK_DEVICES[number], typeof MOCK_LINKS[number]> {
    return {
        nodes: MOCK_DEVICES.map(createNode),
        links: MOCK_LINKS.map(createLink),
    };
}

export default function GraphTest() {
    const fpsRef = useRef<HTMLSpanElement>(null);
    const fpsCountRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const [stateSummary, setStateSummary] = useState("Nós: 0 | Links: 0");
    const [serializedGraph, setSerializedGraph] = useState("");
    const [serializationStatus, setSerializationStatus] = useState("Use os botões abaixo para serializar ou restaurar o snapshot do grafo.");

    const graphApi = useGraphApi({
        onReady: (api) => {
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
                            location: { x: 0, y: 0 },
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
            api.setDefaultLinkTemplate(LinkPath);
            api.registerLinkTemplate("ftth", () => <LinkPath />);
            api.registerLinkTemplate("ether", () => <LinkPath />);

            const snapshot = createMockSnapshot();
            api.deserialize(snapshot);
        },
        // defaultNodeTemplate: (props) => <NodeTemplate {...props} />, // Optional
        // defaultLinkTemplate: (props) => <LinkPath {...props} />, // Optional
    });

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
        api.deserialize(snapshot);
        setSerializedGraph(JSON.stringify(snapshot, null, 2));
        setSerializationStatus("Snapshot de exemplo restaurado via deserialize().");
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

    const handleDeserialize = useCallback(async () => {
        const api = graphApi;
        if (!api) return;

        if (!serializedGraph.trim()) {
            setSerializationStatus("Cole ou gere um JSON antes de desserializar o snapshot.");
            return;
        }

        try {
            api.deserialize(serializedGraph);
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
                    <button onClick={() => handleCentralize()}>Centralizar</button>
                    <button onClick={updateStateSummary}>Ler estado</button>
                    <button onClick={handleSerialize}>Serializar</button>
                    <button onClick={() => void handleDeserialize()}>Desserializar</button>
                    <button onClick={() => void handleLoadMockSnapshot()}>Restaurar demo</button>
                    {LAYOUTS.map(layout => (
                        <button key={layout.algorithm} onClick={() => void handleApplyLayout(layout.algorithm)}>
                            {layout.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderBottom: "1px solid #1a1a1a", backgroundColor: "#070707" }}>
                    <span style={{ fontSize: "0.75rem", color: "#8ab4f8" }}>{serializationStatus}</span>
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