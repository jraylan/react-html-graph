import { useCallback, useEffect, useRef, useState } from "react";
import Graph from "../graph";
import {
    GraphApplyLayoutInput,
    GraphApi,
    NodeObjectTemplateProps,
    NodeDefinition,
    PortRenderProps,
} from "../types";

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
    { s: 'pe01', t: 'pna', bw: '10G', usage: 55 },
    { s: 'pe01', t: 'l3', bw: '10G', usage: 40 },
    { s: 'pe01', t: 'pe05', bw: '1G', usage: 72 },
    { s: 'pe02', t: 'pe06', bw: '1G', usage: 30 },
    { s: 'pe02', t: 'pe07', bw: '1G', usage: 60 },
    { s: 'pe01', t: 'pe02', bw: '1G', usage: 45 },
    { s: 'pe01', t: 'pe08', bw: '1G', usage: 20 },
    { s: 'pe01', t: 'pe03', bw: '1G', usage: 35 },
    { s: 'pe03', t: 'pe04', bw: '1G', usage: 0 },
    { s: 'pe04', t: 'pe09', bw: '1G', usage: 50 },
    { s: 'pe01', t: 'pe10', bw: '1G', usage: 25 },
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

    return <></>
}

function NodeTemplate({ id, ports, data }: NodeObjectTemplateProps<typeof MOCK_DEVICES[number]>) {
    const colors = COLORS[data.status as keyof typeof COLORS] || COLORS.default;
    return <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%" }}>
            {ports.all}
        </div>
        <div
            style={{ borderColor: colors.border, backgroundColor: colors.bg }}
        >
            <div
            >
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



function createNode(data: typeof MOCK_DEVICES[number]): NodeDefinition {
    const { id, x, y } = data;
    return ({
        id: id,
        position: { x: x, y: y, z: 0 },
        data,
        ports: [
            {
                id: "port",
                type: "data",
                direction: "bidirectional",
                location: { x: 0, y: 0 },
                children: NodePort,
            },
        ],
        template: NodeTemplate
    });
}

function createLink(data: typeof MOCK_LINKS[number]) {
    const color = data.usage > 80 ? "#ff3333" : data.usage > 50 ? "#ffaa00" : "#c7c700";
    const bw = parseInt(data.bw.replace("G", "000000000").replace("M", "000000"));
    const duration = Math.max(1, Math.min(10, Math.round((bw * data.usage / 100) / 100000000)));

    return {
        id: `link-${data.s}-${data.t}`,
        from: {
            node: data.s,
            port: "port"
        },
        to: {
            node: data.t,
            port: "port"
        },
        labels: [
            { text: data.bw, position: -0.5, color: "#fff", fontSize: 14 },
            { text: data.usage + '%', position: 0.5, color: "#fff", fontSize: 14 },
        ],
        width: 1,
        spacing: 2,
        forwardColor: color,
        reverseColor: color,
        forwardDuration: duration,
        reverseDuration: duration,
    }

}

export default function GraphTest() {
    const apiRef = useRef<GraphApi>(null);
    const fpsRef = useRef<HTMLSpanElement>(null);
    const fpsCountRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const [stateSummary, setStateSummary] = useState("Nós: 0 | Links: 0");

    const updateStateSummary = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;
        const nodes = api.getNodeStates();
        const links = api.getLinkStates();
        setStateSummary(`Nós: ${nodes.length} | Links: ${links.length}`);
    }, []);

    const handleCentralize = useCallback(async () => {
        const api = apiRef.current;
        if (!api) return;
        await api.centralize({ padding: 48 });
        updateStateSummary();
    }, [updateStateSummary]);

    const handleApplyLayout = useCallback(async (algorithm: GraphApplyLayoutInput["algorithm"]) => {
        const api = apiRef.current;
        if (!api) return;
        await api.applyLayout({
            algorithm,
            options: getLayoutOptions(algorithm),
        });
        await api.centralize({ padding: 40 });
        updateStateSummary();
    }, [updateStateSummary]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            const api = apiRef.current;
            if (api) {
                MOCK_DEVICES.forEach(obj => {
                    api.addNode(createNode(obj));
                })
                MOCK_LINKS.forEach(obj => {
                    api.addLink(createLink(obj));
                })
                void api.centralize({ padding: 48 }).then(updateStateSummary);
            }
        }, 1000);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [updateStateSummary])

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
                    {LAYOUTS.map(layout => (
                        <button key={layout.algorithm} onClick={() => void handleApplyLayout(layout.algorithm)}>
                            {layout.label}
                        </button>
                    ))}
                </div>
                <div className="graph-test-graph">
                    <Graph
                        ref={apiRef}
                        mode="edit"
                        onError={(err) => console.error("[GraphError]", err)}
                    />
                </div>
            </div>
        </>
    );
}