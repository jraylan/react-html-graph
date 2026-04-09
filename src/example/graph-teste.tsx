import { useEffect, useRef } from "react";
import Graph from "../graph";
import {
    GraphApi,
    ConnectionApi,
    NodeObjectTemplateProps,
    PortDragEndEvent,
    LinkDefinition,
    NodeDefinition,
} from "../types";


const TEST_LINKS: LinkDefinition[] = [
    {
        id: "link-a",
        from: {
            node: "foo",
            port: "output"
        },
        to: {
            node: "bar",
            port: "output"
        },
        labels: [
            { text: "Link A", position: -0.5, color: "#fff", fontSize: 14, textAnchor: "forward", offset: 10 },
            { text: "Link B", position: 0.5, color: "#fff", fontSize: 14, textAnchor: "reverse", offset: 10 },
        ],
        width: 1,
        forwardColor: "#c7c700",
        reverseColor: "#c71d07",
        forwardDuration: 3,
        reverseDuration: 0,

    },
    {
        id: "link-b",
        from: {
            node: "tar",
            port: "input"
        },
        to: {
            node: "bar",
            port: "input"
        },
        width: 2,
        labels: [
            { text: "Link A", position: -0.5, color: "#fff", fontSize: 14, textAnchor: "forward", offset: 10 },
            { text: "Link B", position: 0.5, color: "#fff", fontSize: 14, textAnchor: "reverse", offset: 10 },
        ],
        forwardColor: "#c71d07",
        reverseColor: "#1dc707",
        forwardDuration: 0,
        reverseDuration: 1,
    },
    {
        id: "link-c",
        from: {
            node: "foo",
            port: "input"
        },
        to: {
            node: "tar",
            port: "output"
        },
        width: 3,
        labels: [
            { text: "Link A", position: -0.5, color: "#fff", fontSize: 14, textAnchor: "forward", offset: 10 },
            { text: "Link B", position: 0.5, color: "#fff", fontSize: 14, textAnchor: "reverse", offset: 10 },
        ],
        forwardColor: "#c71d07",
        reverseColor: "#1dc707",
        forwardDuration: 0,
        reverseDuration: 1,
    }
]

const TEST_OBJECTS: NodeDefinition[] = [
    {
        id: "foo",
        position: { x: 300, y: 100, z: 0 },
        ports: [
            {
                id: "input",
                type: "data",
                direction: "input" as const,
                location: "left" as const,
                children: () => <div className="node-port" />,
            },
            {
                id: "output",
                type: "data",
                direction: "output" as const,
                location: "right" as const,
                onDragEnd: async (api: ConnectionApi, event: PortDragEndEvent) => {
                    if (event.targetNodeId && event.targetPortName) {
                        api.connect({
                            connectionType: event.connectionType,
                            from: { nodeId: event.sourceNodeId, portName: event.sourcePortName },
                            to: { nodeId: event.targetNodeId, portName: event.targetPortName },
                        });
                    }
                },
                children: () => <div className="node-port" />,
            },
        ],
        template: ({ id, ports }: NodeObjectTemplateProps) => (
            <div style={{ background: "red", display: "flex", alignItems: "center" }}>
                {ports.left}
                <span>Foo</span>
                {ports.right}
            </div>
        )
    },
    {
        id: "bar",
        position: { x: 200, y: 300, z: 0 },
        ports: [
            {
                id: "input",
                type: "data",
                direction: "input" as const,
                location: "left" as const,
                children: () => <div className="node-port" />,
            },
            {
                id: "output",
                type: "data",
                direction: "output" as const,
                location: "right" as const,
                onDragEnd: async (api: ConnectionApi, event: PortDragEndEvent) => {
                    if (event.targetNodeId && event.targetPortName) {
                        api.connect({
                            connectionType: event.connectionType,
                            from: { nodeId: event.sourceNodeId, portName: event.sourcePortName },
                            to: { nodeId: event.targetNodeId, portName: event.targetPortName },
                        });
                    }
                }, children: () => <div className="node-port" />,
            },
        ],
        template: ({ id, ports }: NodeObjectTemplateProps) => (
            <div style={{ background: "blue", display: "flex", alignItems: "center" }}>
                {ports.left}
                <span>Bar</span>
                {ports.right}
            </div>
        )
    },
    {
        id: "tar",
        position: { x: 100, y: 100, z: 0 },
        ports: [
            {
                id: "input",
                type: "data",
                direction: "input" as const,
                location: "left" as const,
                children: () => <div className="node-port" />,
            },
            {
                id: "output",
                type: "data",
                direction: "output" as const,
                location: "right" as const,
                onDragEnd: async (api: ConnectionApi, event: PortDragEndEvent) => {
                    if (event.targetNodeId && event.targetPortName) {
                        api.connect({
                            connectionType: event.connectionType,
                            from: { nodeId: event.sourceNodeId, portName: event.sourcePortName },
                            to: { nodeId: event.targetNodeId, portName: event.targetPortName },
                        });
                    }
                }, children: () => <div className="node-port" />,
            },
        ],
        template: ({ id, ports }: NodeObjectTemplateProps) => (
            <div style={{ background: "blue", display: "flex", alignItems: "center" }}>
                {ports.left}
                <span>Tar</span>
                {ports.right}
            </div>
        )
    }
];



export default function GraphTest() {
    const apiRef = useRef<GraphApi>(null);
    const fpsRef = useRef<HTMLSpanElement>(null);
    const fpsCountRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            const api = apiRef.current;
            if (api) {
                TEST_OBJECTS.forEach(obj => {
                    api.addNode(obj);
                })
                TEST_LINKS.forEach(obj => {
                    api.addLink(obj);
                })
            }
        }, 1000);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [])

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
                <span ref={fpsRef} />
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