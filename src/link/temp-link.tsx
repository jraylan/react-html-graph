import { useContext, useState, useEffect } from "react";
import { ConnectionContext } from "../context/connection-context";
import useGetViewbox from "../hooks/get-viewbox";
import useGraphRoot from "../hooks/graph-root";

/**
 * Componente que renderiza um link temporário enquanto o usuário arrasta uma
 * conexão entre portas. Desenha uma curva Bezier entre a posição da porta
 * origem e o cursor.
 *
 * @returns JSX.Element | null
 */
export default function TempLink() {
    const { dragState } = useContext(ConnectionContext);
    const getViewbox = useGetViewbox();
    const graphRoot = useGraphRoot();
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const [sourcePos, setSourcePos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!dragState.active) return;

        const handleMouseMove = (e: MouseEvent) => {
            const graph = graphRoot.current;
            if (!graph) return;
            const rect = graph.getBoundingClientRect();
            const viewbox = getViewbox();
            setCursor({
                x: (e.clientX - rect.left) / viewbox.zoom + viewbox.x,
                y: (e.clientY - rect.top) / viewbox.zoom + viewbox.y,
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, [dragState.active, getViewbox, graphRoot]);

    useEffect(() => {
        if (!dragState.active) {
            setSourcePos(null);
            return;
        }

        const graph = graphRoot.current;
        if (!graph) return;

        const el = graph.querySelector(
            `node-graph-object[node-id="${dragState.sourceNodeId}"] node-graph-port[port-id="${dragState.sourcePortName}"]`
        );
        if (!el) return;


        const graphRect = graph.getBoundingClientRect();
        const portRect = el.getBoundingClientRect();
        const viewbox = getViewbox();

        setSourcePos({
            x: (portRect.left + portRect.width / 2 - graphRect.left) / viewbox.zoom + viewbox.x,
            y: (portRect.top + portRect.height / 2 - graphRect.top) / viewbox.zoom + viewbox.y,
        });
    }, [dragState, getViewbox, graphRoot]);

    if (!dragState.active || !sourcePos) return null;

    const dx = cursor.x - sourcePos.x;
    const cp = Math.abs(dx) * 0.5 || 50;
    const d = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + cp} ${sourcePos.y}, ${cursor.x - cp} ${cursor.y}, ${cursor.x} ${cursor.y}`;

    return (
        <node-graph-temp-link>
            <svg>
                <path d={d} fill="none" stroke="#888" strokeWidth={2} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
            </svg>
        </node-graph-temp-link>
    );
}

