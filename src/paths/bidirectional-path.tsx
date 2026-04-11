import { useRef, useState, useCallback, useEffect } from "react";
import { calculatePath, calculateLabels } from "../calculations";
import { PortDirection } from "../calculations/types";
import { useViewbox, useGraphError, useGraphRoot } from "../module";
import { LinkLabel } from "../types";
import useLinkInfo from "../hooks/link-info";

type StandardTextAnchor = "start" | "middle" | "end" | undefined;

export type BidirectionalPathProps = {
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
}

export default function BidirectionalPath({
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
}: BidirectionalPathProps) {

    const { id, from, to, fromNode, fromPort, toNode, toPort, onStateChange } = useLinkInfo();

    const rootRef = useRef<SVGSVGElement>(null);
    const forwardRef = useRef<SVGPathElement>(null);
    const reverseRef = useRef<SVGPathElement>(null);
    const labelGroupRef = useRef<SVGGElement>(null);
    const [invalid, setInvalid] = useState<boolean>(true);
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

    // Verifica se os nós existem no DOM
    const checkNodes = useCallback(() => {
        const root = graphRoot.current;
        if (!root) return;

        if (!fromNode || !toNode) {
            if (!fromNode) {
                reportError("ORPHAN_LINK", `Link "${id}": nó de origem "${from.node}" não encontrado`, { linkId: id, nodeId: from.node });
            }
            if (!toNode) {
                reportError("ORPHAN_LINK", `Link "${id}": nó de destino "${to.node}" não encontrado`, { linkId: id, nodeId: to.node });
            }
            return setInvalid(true);
        }
        setInvalid(false);
    }, [fromNode, toNode, id, from.node, to.node, reportError, graphRoot]);

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

    // Acumula offsets do elemento até o ancestral de referência
    const accumulateOffset = useCallback(
        (el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } => {
            let x = 0;
            let y = 0;
            let current: HTMLElement | null = el;
            while (current && current !== ancestor) {
                x += current.offsetLeft;
                y += current.offsetTop;
                current = current.offsetParent as HTMLElement | null;
            }
            return { x, y };
        },
        []
    );

    // Determina a direção da porta pela posição real dentro do nó.
    // Quando a porta estiver centralizada, usa o vetor entre origem e destino
    // como heurística para escolher um lado mais natural.
    const detectPortDir = useCallback(
        (
            node: HTMLElement,
            portOrigin: { x: number; y: number } | null,
            delta: { x: number; y: number },
            invertDelta = false,
        ): PortDirection => {
            const normalizedDelta = invertDelta
                ? { x: -delta.x, y: -delta.y }
                : delta;

            if (!portOrigin) {
                if (Math.abs(normalizedDelta.x) >= Math.abs(normalizedDelta.y)) {
                    return normalizedDelta.x >= 0 ? "right" : "left";
                }
                return normalizedDelta.y >= 0 ? "bottom" : "top";
            }

            const relX = portOrigin.x - node.offsetWidth / 2;
            const relY = portOrigin.y - node.offsetHeight / 2;
            const toleranceX = Math.max(4, node.offsetWidth * 0.05);
            const toleranceY = Math.max(4, node.offsetHeight * 0.05);
            const isCentered = Math.abs(relX) <= toleranceX && Math.abs(relY) <= toleranceY;

            if (!isCentered) {
                if (Math.abs(relX) >= Math.abs(relY)) {
                    return relX >= 0 ? "right" : "left";
                }
                return relY >= 0 ? "bottom" : "top";
            }

            if (Math.abs(normalizedDelta.x) >= Math.abs(normalizedDelta.y)) {
                return normalizedDelta.x >= 0 ? "right" : "left";
            }
            return normalizedDelta.y >= 0 ? "bottom" : "top";
        },
        []
    );

    // Lê posições do DOM via ref (sem setState), agenda rAF
    const readPositions = useCallback(() => {
        if (!fromNode || !toNode) return;

        const fromPortOffset = fromPort
            ? accumulateOffset(fromPort, fromNode)
            : { x: fromNode.offsetWidth / 2, y: fromNode.offsetHeight / 2 };
        const toPortOffset = toPort
            ? accumulateOffset(toPort, toNode)
            : { x: toNode.offsetWidth / 2, y: toNode.offsetHeight / 2 };

        const fromPortOrigin = fromPort
            ? {
                x: fromPortOffset.x + fromPort.offsetWidth / 2,
                y: fromPortOffset.y + fromPort.offsetHeight / 2,
            } : null;
        const toPortOrigin = toPort
            ? {
                x: toPortOffset.x + toPort.offsetWidth / 2,
                y: toPortOffset.y + toPort.offsetHeight / 2,
            } : null;

        const fromX = fromNode.offsetLeft + (fromPortOrigin?.x ?? fromPortOffset.x);
        const fromY = fromNode.offsetTop + (fromPortOrigin?.y ?? fromPortOffset.y);
        const toX = toNode.offsetLeft + (toPortOrigin?.x ?? toPortOffset.x);
        const toY = toNode.offsetTop + (toPortOrigin?.y ?? toPortOffset.y);
        const delta = { x: toX - fromX, y: toY - fromY };

        positionsRef.current = {
            fromX, fromY,
            toX, toY,
            fromDir: detectPortDir(fromNode, fromPortOrigin, delta),
            toDir: detectPortDir(toNode, toPortOrigin, delta, true),
        };
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(runCalculation);
    }, [fromNode, fromPort, toNode, toPort, accumulateOffset, detectPortDir, runCalculation]);

    // Observar mudanças nos nós (posição, tamanho, existência) e recalcular
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

    // Limpa animation frame ao desmontar
    useEffect(() => {
        return () => cancelAnimationFrame(rafIdRef.current);
    }, []);

    // Reporta estado inválido ao contexto
    useEffect(() => {
        if (!invalid) return;
        onStateChange?.({
            id,
            from: {
                nodeId: from.node,
                portId: from.port,
                x: 0,
                y: 0,
                direction: "right",
            },
            to: {
                nodeId: to.node,
                portId: to.port,
                x: 0,
                y: 0,
                direction: "left",
            },
            bounds: { left: 0, top: 0, width: 0, height: 0 },
            invalid: true,
        });
    }, [from.node, from.port, id, invalid, to.node, to.port, onStateChange]);

    if (invalid) return <></>;

    const fwdStroke = fwdW / viewbox.zoom;
    const revStroke = revW / viewbox.zoom;
    const scaledDash = dashSize / viewbox.zoom;
    const scaledGap = gapSize / viewbox.zoom;
    const dashPattern = scaledDash + " " + scaledGap;
    const cycleLen = scaledDash + scaledGap;

    return (
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
    );
}