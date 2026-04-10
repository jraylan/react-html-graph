import { memo, useCallback, useEffect, useRef, useState } from "react";
import useViewbox from "../hooks/viewbox";
import useGraphError from "../hooks/error";
import useGraphRoot from "../hooks/graph-root";
import { calculatePath, calculateLabels } from "../calculations";
import { PortDirection } from "../calculations/types";
import { LinkLabel } from "../types";

type StandardTextAnchor = "start" | "middle" | "end" | undefined;

type GraphLinkProps = {
    id: string;
    from: { node: string; port: string };
    to: { node: string; port: string };
    width?: number;
    forwardWidth?: number;
    reverseWidth?: number;
    spacing?: number;
    labels?: LinkLabel[];
    forwardColor?: string;
    reverseColor?: string;
    dashSize?: number;
    gapSize?: number;
    forwardDuration?: number;
    reverseDuration?: number;
};

/**
 * Componente que renderiza um link entre dois nós usando caminhos SVG.
 * Os cálculos de path e posicionamento de labels são realizados em worker
 * para não bloquear o thread principal.
 *
 * @param props Propriedades do link (GraphLinkProps)
 * @returns JSX.Element
 */
const MemoizedGraphLink = memo(function GraphLink({
    id,
    from,
    to,
    width = 3,
    forwardWidth,
    reverseWidth,
    spacing,
    labels,
    forwardColor = "#888",
    reverseColor = "#888",
    dashSize = 12,
    gapSize = 8,
    forwardDuration = 1,
    reverseDuration = 1,
}: GraphLinkProps) {
    const rootRef = useRef<SVGSVGElement>(null);
    const forwardRef = useRef<SVGPathElement>(null);
    const reverseRef = useRef<SVGPathElement>(null);
    const labelGroupRef = useRef<SVGGElement>(null);
    const [invalid, setInvalid] = useState<boolean>(true);
    const [fromNode, setFromNode] = useState<HTMLElement | null>(null);
    const [toNode, setToNode] = useState<HTMLElement | null>(null);
    const viewbox = useViewbox();
    const { reportError } = useGraphError();
    const graphRoot = useGraphRoot();

    const fwdW = forwardWidth ?? width;
    const revW = reverseWidth ?? width;
    const gap = spacing ?? (fwdW + revW) / 2 + 1;

    // Refs para acesso no hot-path (sem React state/render)
    const positionsRef = useRef<{
        fromX: number; fromY: number; toX: number; toY: number;
        fromDir: PortDirection; toDir: PortDirection;
    } | null>(null);
    const rafIdRef = useRef(0);
    const calcVersionRef = useRef(0);
    const gapRef = useRef(gap);
    const labelsRef = useRef(labels);
    const invalidRef = useRef(invalid);
    gapRef.current = gap;
    labelsRef.current = labels;
    invalidRef.current = invalid;

    // Descobre nós
    const checkNodes = useCallback(() => {
        const root = graphRoot.current;
        if (!root) return;
        const fromElement: HTMLElement | null = root.querySelector('node-graph-object[node-id="' + from.node + '"]');
        const toElement: HTMLElement | null = root.querySelector('node-graph-object[node-id="' + to.node + '"]');

        if (!fromElement || !toElement) {
            if (!fromElement) {
                reportError("ORPHAN_LINK", `Link "${id}": source node "${from.node}" not found`, { linkId: id, nodeId: from.node });
            }
            if (!toElement) {
                reportError("ORPHAN_LINK", `Link "${id}": target node "${to.node}" not found`, { linkId: id, nodeId: to.node });
            }
            return setInvalid(true);
        }
        setInvalid(false);
        setFromNode(fromElement);
        setToNode(toElement);
    }, [from.node, to.node, id, reportError, graphRoot]);

    useEffect(() => { checkNodes(); }, [checkNodes]);

    // Calcula paths e labels no worker e atualiza DOM diretamente (sem React render)
    const runCalculation = useCallback(() => {
        const pos = positionsRef.current;
        if (!pos || invalidRef.current) return;

        const root = rootRef.current;
        const fwd = forwardRef.current;
        const rev = reverseRef.current;
        if (!root || !fwd || !rev) return;

        const currentGap = gapRef.current;
        const currentLabels = labelsRef.current;
        const version = ++calcVersionRef.current;
        const halfGap = currentGap / 2;

        const labelInputs = currentLabels?.map(lbl => ({
            position: lbl.position ?? 0,
            side: lbl.textAnchor === "forward" || lbl.textAnchor === "reverse" ? lbl.textAnchor : "",
            offset: lbl.offset ?? 0,
        }));

        const pathPromise = calculatePath({
            fromX: pos.fromX, fromY: pos.fromY,
            toX: pos.toX, toY: pos.toY,
            fromDir: pos.fromDir, toDir: pos.toDir,
            gap: currentGap, steps: 60,
        });

        const labelsPromise = labelInputs?.length
            ? calculateLabels({ fromX: pos.fromX, fromY: pos.fromY, toX: pos.toX, toY: pos.toY, fromDir: pos.fromDir, toDir: pos.toDir, halfGap, labels: labelInputs })
            : Promise.resolve(null);

        Promise.all([pathPromise, labelsPromise]).then(([pathResult, labelResult]) => {
            // Descarta resultado obsoleto
            if (version !== calcVersionRef.current) return;

            const { bounds, forwardD, reverseD } = pathResult;
            root.style.left = bounds.left + "px";
            root.style.top = bounds.top + "px";
            root.style.width = bounds.width + "px";
            root.style.height = bounds.height + "px";
            root.setAttribute("viewBox", `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);

            fwd.setAttribute("d", forwardD);
            rev.setAttribute("d", reverseD);

            if (labelResult) {
                const labelGroup = labelGroupRef.current;
                if (labelGroup) {
                    const textEls = labelGroup.querySelectorAll<SVGTextElement>("text");
                    labelResult.positions.forEach((lPos, i) => {
                        const textEl = textEls[i];
                        if (!textEl) return;
                        textEl.setAttribute("x", String(lPos.x));
                        textEl.setAttribute("y", String(lPos.y));
                        if (lPos.textAnchor !== "middle") {
                            textEl.setAttribute("text-anchor", lPos.textAnchor);
                        }
                    });
                }
            }
        });
    }, []);

    // Determina direcao de saida da porta baseado na posicao relativa ao centro do no
    const detectPortDir = useCallback(
        (node: HTMLElement, port: HTMLElement | null): PortDirection => {
            if (!port) return "right";
            const relX = port.offsetLeft + port.offsetWidth / 2 - node.offsetWidth / 2;
            const relY = port.offsetTop + port.offsetHeight / 2 - node.offsetHeight / 2;
            if (Math.abs(relX) >= Math.abs(relY)) {
                return relX >= 0 ? "right" : "left";
            }
            return relY >= 0 ? "bottom" : "top";
        },
        []
    );

    // Le posicoes do DOM via ref (sem setState), agenda rAF
    const readPositions = useCallback(() => {
        if (!fromNode || !toNode) return;
        const fromPort = fromNode.querySelector<HTMLElement>('node-graph-port[port-id="' + from.port + '"]');
        const toPort = toNode.querySelector<HTMLElement>('node-graph-port[port-id="' + to.port + '"]');
        positionsRef.current = {
            fromX: fromNode.offsetLeft + (fromPort ? fromPort.offsetLeft + fromPort.offsetWidth / 2 : fromNode.offsetWidth),
            fromY: fromNode.offsetTop + (fromPort ? fromPort.offsetTop + fromPort.offsetHeight / 2 : fromNode.offsetHeight / 2),
            toX: toNode.offsetLeft + (toPort ? toPort.offsetLeft + toPort.offsetWidth / 2 : 0),
            toY: toNode.offsetTop + (toPort ? toPort.offsetTop + toPort.offsetHeight / 2 : toNode.offsetHeight / 2),
            fromDir: detectPortDir(fromNode, fromPort),
            toDir: detectPortDir(toNode, toPort),
        };
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(runCalculation);
    }, [fromNode, toNode, from.port, to.port, detectPortDir, runCalculation]);

    // Observe node changes
    useEffect(() => {
        if (!fromNode || !toNode || invalid) return;
        readPositions();

        const mutationObserver = new MutationObserver((entries) => {
            for (const entry of entries) {
                if (entry.attributeName === "node-id") { checkNodes(); return; }
            }
            readPositions();
        });
        mutationObserver.observe(fromNode, { attributes: true, attributeFilter: ["style", "class", "node-id"] });
        mutationObserver.observe(toNode, { attributes: true, attributeFilter: ["style", "class", "node-id"] });

        const resizeObserver = new ResizeObserver(readPositions);
        resizeObserver.observe(fromNode);
        resizeObserver.observe(toNode);

        return () => { mutationObserver.disconnect(); resizeObserver.disconnect(); };
    }, [fromNode, toNode, invalid, checkNodes, readPositions]);

    // Recalcula quando viewbox muda
    useEffect(() => {
        if (!fromNode || !toNode || invalid) return;
        readPositions();
    }, [viewbox.zoom, fromNode, toNode, invalid, readPositions]);

    // Limpa rAF ao desmontar
    useEffect(() => {
        return () => cancelAnimationFrame(rafIdRef.current);
    }, []);

    if (invalid) return <></>;

    const fwdStroke = fwdW / viewbox.zoom;
    const revStroke = revW / viewbox.zoom;
    const scaledDash = dashSize / viewbox.zoom;
    const scaledGap = gapSize / viewbox.zoom;
    const dashPattern = scaledDash + " " + scaledGap;
    const cycleLen = scaledDash + scaledGap;


    return (<node-graph-link>
        <svg ref={rootRef}>
            <path
                ref={forwardRef}
                d=""
                stroke={forwardColor}
                fill="none"
                strokeWidth={fwdStroke}
                strokeLinecap="round"
                strokeDasharray={dashPattern}
                style={{
                    animationDuration: forwardDuration > 0 ? forwardDuration + "s" : "0s",
                    animationDirection: "normal",
                    ["--cycle-len" as string]: cycleLen + "px",
                }}
            />
            <path
                ref={reverseRef}
                d=""
                stroke={reverseColor}
                fill="none"
                strokeWidth={revStroke}
                strokeLinecap="round"
                strokeDasharray={dashPattern}
                style={{
                    animationDuration: reverseDuration > 0 ? reverseDuration + "s" : "0s",
                    animationDirection: "reverse",
                    ["--cycle-len" as string]: cycleLen + "px",
                }}
            />
            {labels && labels.length > 0 && (
                <g ref={labelGroupRef}>
                    {labels.map((lbl, i) => {
                        const isDirectional = lbl.textAnchor === "forward" || lbl.textAnchor === "reverse";
                        const textAnchor = isDirectional ? undefined : (lbl.textAnchor ?? "middle") as StandardTextAnchor;
                        return (
                            <text
                                key={i}
                                fill={lbl.color ?? "#fff"}
                                fontSize={(lbl.fontSize ?? 12) / viewbox.zoom}
                                fontFamily={lbl.fontFamily}
                                fontWeight={lbl.fontWeight}
                                fontStyle={lbl.fontStyle}
                                textAnchor={textAnchor}
                                opacity={lbl.opacity}
                                letterSpacing={lbl.letterSpacing}
                                textDecoration={lbl.textDecoration}
                                dx={!isDirectional && lbl.dx ? lbl.dx / viewbox.zoom : undefined}
                                dy={!isDirectional
                                    ? (lbl.dy != null ? lbl.dy / viewbox.zoom : -(Math.max(fwdStroke, revStroke) + 4 / viewbox.zoom))
                                    : undefined
                                }
                            >
                                {lbl.text}
                            </text>
                        );
                    })}
                </g>
            )}
        </svg>
    </node-graph-link>);
})

export default MemoizedGraphLink;
