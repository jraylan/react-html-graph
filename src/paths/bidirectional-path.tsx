import { useRef, useCallback, useEffect } from "react";
import useMathProvider from "../hooks/math-provider";
import { BidirectionalLinkLabel, GraphLinkAnchor } from "../types";
import { calculateLiveBidirectionalLabelsPreview, calculateLiveBidirectionalPathPreview } from "../utils/link-path-preview";
import useGetZoom from "../hooks/get-zoom";

type StandardTextAnchor = "start" | "middle" | "end" | undefined;
const BIDIRECTIONAL_PATH_STEPS = 5;

type LivePathAnchors = {
    getFrom: () => GraphLinkAnchor | null;
    getTo: () => GraphLinkAnchor | null;
    subscribe: (listener: (phase?: "live" | "commit") => void) => () => void;
};

export type BidirectionalPathProps = {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
    liveAnchors?: LivePathAnchors;
    data?: unknown;
    width?: number;
    forwardWidth?: number;
    reverseWidth?: number;
    spacing?: number;
    labels?: BidirectionalLinkLabel[];
    forwardColor?: string;
    reverseColor?: string;
    dashSize?: number;
    gapSize?: number;
    forwardDuration?: number;
    reverseDuration?: number;
    steps?: number;
    rootRef: React.RefObject<HTMLDivElement>;
}

export default function BidirectionalPath({
    from,
    to,
    liveAnchors,
    width = 3,
    forwardWidth,
    reverseWidth,
    spacing = 3,
    labels,
    forwardColor = "#888",
    reverseColor = "#888",
    dashSize = 10,
    gapSize = 10,
    forwardDuration = 1,
    reverseDuration = 1,
    rootRef,
    steps = BIDIRECTIONAL_PATH_STEPS,
}: BidirectionalPathProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const forwardRef = useRef<SVGPathElement>(null);
    const reverseRef = useRef<SVGPathElement>(null);
    const labelGroupRef = useRef<SVGGElement>(null);
    const mathProvider = useMathProvider();
    const liveFrameRef = useRef<number | null>(null);
    const getZoom = useGetZoom();
    const fwdDashOffset = useRef(0);
    const revDashOffset = useRef(0);
    const cycleLenRef = useRef(0);
    const fwdW = forwardWidth ?? width;
    const revW = reverseWidth ?? width;
    const gap = spacing / getZoom();

    const calcVersionRef = useRef(0);

    // Calcula paths e labels no worker e atualiza DOM diretamente (sem React render)
    const runCalculation = useCallback(() => {
        const svg = svgRef.current;
        const root = rootRef.current;
        const fwd = forwardRef.current;
        const rev = reverseRef.current;
        if (!svg || !fwd || !rev) return;

        const resolvedFrom = liveAnchors?.getFrom() ?? from;
        const resolvedTo = liveAnchors?.getTo() ?? to;
        if (!resolvedFrom || !resolvedTo) return;

        const version = ++calcVersionRef.current;
        const halfGap = gap * getZoom() / 2;

        const labelInputs = labels?.map(lbl => ({
            position: lbl.position ?? 0,
            side: lbl.textAnchor === "forward" || lbl.textAnchor === "reverse" ? lbl.textAnchor : "",
            offset: lbl.offset ?? 0,
        }));

        const pathPromise = mathProvider.calculateBidirectionalPath({
            fromX: resolvedFrom.x, fromY: resolvedFrom.y,
            toX: resolvedTo.x, toY: resolvedTo.y,
            fromVector: resolvedFrom.d,
            toVector: resolvedTo.d,
            gap,
            steps,
        });

        const labelsPromise = labelInputs?.length
            ? mathProvider.calculateBidirectionalLabels({
                fromX: resolvedFrom.x,
                fromY: resolvedFrom.y,
                toX: resolvedTo.x,
                toY: resolvedTo.y,
                fromVector: resolvedFrom.d,
                toVector: resolvedTo.d,
                halfGap,
                labels: labelInputs,
            })
            : Promise.resolve(null);

        Promise.all([pathPromise, labelsPromise]).then(([pathResult, labelResult]) => {
            // Descarta resultado obsoleto
            if (version !== calcVersionRef.current) return;

            const { bounds, forwardD, reverseD } = pathResult;
            root.style.left = bounds.left + "px";
            root.style.top = bounds.top + "px";
            root.style.width = bounds.width + "px";
            root.style.height = bounds.height + "px";

            svg.setAttribute("viewBox", `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);
            fwd.setAttribute("d", forwardD);
            rev.setAttribute("d", reverseD);

            if (labelResult) {
                const labelGroup = labelGroupRef.current;
                if (labelGroup) {
                    const textEls = labelGroup.querySelectorAll<SVGTextElement>("text");
                    labelResult.forEach((lPos, i) => {
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
    }, [from, gap, labels, liveAnchors, mathProvider, steps, to, getZoom, rootRef]);

    const runLiveCalculation = useCallback(() => {
        const svg = svgRef.current;
        const fwd = forwardRef.current;
        const rev = reverseRef.current;
        const root = rootRef.current;
        if (!svg || !fwd || !rev) return;

        const resolvedFrom = liveAnchors?.getFrom() ?? from;
        const resolvedTo = liveAnchors?.getTo() ?? to;
        if (!resolvedFrom || !resolvedTo) return;

        const result = calculateLiveBidirectionalPathPreview({
            from: resolvedFrom,
            to: resolvedTo,
            gap,
            steps,
        });

        root.style.left = result.bounds.left + "px";
        root.style.top = result.bounds.top + "px";
        root.style.width = result.bounds.width + "px";
        root.style.height = result.bounds.height + "px";
        svg.setAttribute("viewBox", `${result.bounds.left} ${result.bounds.top} ${result.bounds.width} ${result.bounds.height}`);
        fwd.setAttribute("d", result.forwardD);
        rev.setAttribute("d", result.reverseD);

        const labelGroup = labelGroupRef.current;
        if (labelGroup && labels?.length) {
            const textEls = labelGroup.querySelectorAll<SVGTextElement>("text");
            const liveLabelPositions = calculateLiveBidirectionalLabelsPreview({
                from: resolvedFrom,
                to: resolvedTo,
                halfGap: gap / 2,
                labels: labels.map(label => ({
                    position: label.position ?? 0,
                    side: label.textAnchor === "forward" || label.textAnchor === "reverse" ? label.textAnchor : "",
                    offset: label.offset ?? 0,
                })),
            });

            liveLabelPositions.forEach((labelPosition, index) => {
                const textEl = textEls[index];
                if (!textEl) return;
                textEl.setAttribute("x", String(labelPosition.x));
                textEl.setAttribute("y", String(labelPosition.y));
                if (labelPosition.textAnchor !== "middle") {
                    textEl.setAttribute("text-anchor", labelPosition.textAnchor);
                }
            });
        }
    }, [from, gap, labels, liveAnchors, steps, to, rootRef]);

    useEffect(() => {
        runCalculation();
    }, [runCalculation]);

    useEffect(() => {
        if (!liveAnchors) return;
        return liveAnchors.subscribe((phase) => {
            if (phase === "live") {
                if (liveFrameRef.current != null) {
                    return;
                }

                liveFrameRef.current = requestAnimationFrame(() => {
                    liveFrameRef.current = null;
                    runLiveCalculation();
                });
                return;
            }

            if (liveFrameRef.current != null) {
                cancelAnimationFrame(liveFrameRef.current);
                liveFrameRef.current = null;
            }

            runCalculation();
        });
    }, [liveAnchors, runCalculation, runLiveCalculation]);

    useEffect(() => () => {
        if (liveFrameRef.current != null) {
            cancelAnimationFrame(liveFrameRef.current);
            liveFrameRef.current = null;
        }
    }, []);


    const zoom = getZoom();
    const fwdStroke = fwdW / zoom;
    const revStroke = revW / zoom;
    const scaledDash = dashSize / zoom;
    const scaledGap = gapSize / zoom;
    const dashPattern = scaledDash + " " + scaledGap;

    cycleLenRef.current = scaledDash + scaledGap;

    const animateFunction = useCallback((dt: number) => {
        fwdDashOffset.current += (dt * 1 / forwardDuration) * cycleLenRef.current;
        revDashOffset.current += (dt * 1 / reverseDuration) * cycleLenRef.current;
        forwardRef.current?.style.setProperty("stroke-dashoffset", fwdDashOffset.current.toString());
        reverseRef.current?.style.setProperty("stroke-dashoffset", (-revDashOffset.current).toString());
    }, [forwardDuration, reverseDuration])


    useEffect(() => {
        let lastTime = performance.now();
        const animate = (time: number) => {
            const dt = time - lastTime;
            animateFunction(dt / 1000)
            lastTime = time;
            requestAnimationFrame(animate);
        };

        let animationFrameId: number = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(animationFrameId);
        }
    }, [animateFunction])


    return (
        <svg ref={svgRef} style={{ position: "relative", left: 0, top: 0, width: "100%", height: "100%" }}>
            <path
                ref={forwardRef}
                d=""
                stroke={forwardColor}
                fill="none"
                strokeWidth={fwdStroke}
                strokeLinecap="round"
                strokeDasharray={dashPattern}
            />
            <path
                ref={reverseRef}
                d=""
                stroke={reverseColor}
                fill="none"
                strokeWidth={revStroke}
                strokeLinecap="round"
                strokeDasharray={dashPattern}
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
                                fontSize={(lbl.fontSize ?? 12) / zoom}
                                fontFamily={lbl.fontFamily}
                                fontWeight={lbl.fontWeight}
                                fontStyle={lbl.fontStyle}
                                textAnchor={textAnchor}
                                opacity={lbl.opacity}
                                letterSpacing={lbl.letterSpacing}
                                textDecoration={lbl.textDecoration}
                                dx={!isDirectional && lbl.dx ? lbl.dx / zoom : undefined}
                                dy={!isDirectional
                                    ? (lbl.dy != null ? lbl.dy / zoom : -(Math.max(fwdStroke, revStroke) + 4 / zoom))
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