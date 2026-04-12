import { useRef, useCallback, useEffect } from "react";
import { useViewbox } from "../module";
import useMathProvider from "../hooks/math-provider";
import { GraphLinkAnchor, LinkLabel } from "../types";
import { calculateLiveLabelsPreview, calculateLivePathPreview } from "../utils/link-path-preview";
import useGetZoom from "../hooks/get-zoom";

const UNIDIRECTIONAL_PATH_STEPS = 5;

type LivePathAnchors = {
    getFrom: () => GraphLinkAnchor | null;
    getTo: () => GraphLinkAnchor | null;
    subscribe: (listener: (phase?: "live" | "commit") => void) => () => void;
};

export type UnidirectionalPathProps = {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
    liveAnchors?: LivePathAnchors;
    data?: unknown;
    width?: number;
    labels?: LinkLabel[];
    color?: string;
    dashSize?: number;
    animationDuration?: number;
}

export default function UnidirectionalPath({
    from,
    to,
    liveAnchors,
    width = 3,
    labels,
    color = "#888",
    dashSize = 12,
    animationDuration = 1,
}: UnidirectionalPathProps) {
    const rootRef = useRef<SVGSVGElement>(null);
    const pRef = useRef<SVGPathElement>(null);
    const labelGroupRef = useRef<SVGGElement>(null);
    const viewbox = useViewbox();
    const mathProvider = useMathProvider();
    const calcVersionRef = useRef(0);
    const liveFrameRef = useRef<number | null>(null);
    const dashOffset = useRef(0);
    const cycleLenRef = useRef(0);
    const getZoom = useGetZoom();


    // Calcula paths e labels no worker e atualiza DOM diretamente (sem React render)
    const runCalculation = useCallback(() => {
        const root = rootRef.current;
        const p = pRef.current;
        if (!root || !p) return;

        const resolvedFrom = liveAnchors?.getFrom() ?? from;
        const resolvedTo = liveAnchors?.getTo() ?? to;
        if (!resolvedFrom || !resolvedTo) return;

        const version = ++calcVersionRef.current;

        const labelInputs = labels?.map(lbl => ({
            position: lbl.position ?? 0,
            offset: lbl.offset ?? 0,
        }));

        const pathPromise = mathProvider.calculatePath({
            fromX: resolvedFrom.x, fromY: resolvedFrom.y,
            toX: resolvedTo.x, toY: resolvedTo.y,
            fromVector: resolvedFrom.d,
            toVector: resolvedTo.d,
            steps: UNIDIRECTIONAL_PATH_STEPS,
        });

        const labelsPromise = labelInputs?.length
            ? mathProvider.calculateLabels({
                fromX: resolvedFrom.x,
                fromY: resolvedFrom.y,
                toX: resolvedTo.x,
                toY: resolvedTo.y,
                fromVector: resolvedFrom.d,
                toVector: resolvedTo.d,
                labels: labelInputs,
            })
            : Promise.resolve(null);

        Promise.all([pathPromise, labelsPromise]).then(([pathResult, labelResult]) => {
            // Descarta resultado obsoleto
            if (version !== calcVersionRef.current) return;

            const { bounds, pathD } = pathResult;

            root.style.left = bounds.left + "px";
            root.style.top = bounds.top + "px";
            root.style.width = bounds.width + "px";
            root.style.height = bounds.height + "px";

            root.setAttribute("viewBox", `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);
            p.setAttribute("d", pathD);

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
    }, [from, labels, liveAnchors, mathProvider, to]);

    const runLiveCalculation = useCallback(() => {
        const root = rootRef.current;
        const p = pRef.current;
        if (!root || !p) return;

        const resolvedFrom = liveAnchors?.getFrom() ?? from;
        const resolvedTo = liveAnchors?.getTo() ?? to;
        if (!resolvedFrom || !resolvedTo) return;

        const result = calculateLivePathPreview({
            from: resolvedFrom,
            to: resolvedTo,
            steps: UNIDIRECTIONAL_PATH_STEPS,
        });

        root.style.left = result.bounds.left + "px";
        root.style.top = result.bounds.top + "px";
        root.style.width = result.bounds.width + "px";
        root.style.height = result.bounds.height + "px";
        root.setAttribute("viewBox", `${result.bounds.left} ${result.bounds.top} ${result.bounds.width} ${result.bounds.height}`);
        p.setAttribute("d", result.pathD);

        const labelGroup = labelGroupRef.current;
        if (labelGroup && labels?.length) {
            const textEls = labelGroup.querySelectorAll<SVGTextElement>("text");
            const liveLabelPositions = calculateLiveLabelsPreview({
                from: resolvedFrom,
                to: resolvedTo,
                labels: labels.map(label => ({
                    position: label.position ?? 0,
                    offset: label.offset ?? 0,
                })),
            });

            liveLabelPositions.forEach((labelPosition, index) => {
                const textEl = textEls[index];
                if (!textEl) return;
                textEl.setAttribute("x", String(labelPosition.x));
                textEl.setAttribute("y", String(labelPosition.y));
            });
        }
    }, [from, labels, liveAnchors, to]);

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
    const pStroke = width / zoom;
    const scaledDash = dashSize / zoom;
    const cycleLen = scaledDash;
    cycleLenRef.current = cycleLen;

    const animateFunction = useCallback((dt: number) => {
        dashOffset.current += (dt * 1 / animationDuration) * cycleLenRef.current;
        pRef.current?.style.setProperty("stroke-dashoffset", dashOffset.current.toString());
    }, [animationDuration])


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
        <svg ref={rootRef}>
            <path
                ref={pRef}
                d=""
                stroke={color}
                fill="none"
                strokeWidth={pStroke}
                strokeLinecap="round"
                strokeDasharray={scaledDash}
                style={{
                    animationDuration: animationDuration > 0 ? animationDuration + "s" : "0s",
                    animationDirection: "normal",
                    ["--cycle-len" as string]: cycleLen + "px",
                }}
            />
            {labels && labels.length > 0 && (
                <g ref={labelGroupRef}>
                    {labels.map((lbl, i) => {
                        return (
                            <text
                                key={i}
                                fill={lbl.color ?? "#fff"}
                                fontSize={(lbl.fontSize ?? 12) / viewbox.zoom}
                                fontFamily={lbl.fontFamily}
                                fontWeight={lbl.fontWeight}
                                fontStyle={lbl.fontStyle}
                                textAnchor={lbl.textAnchor ?? "middle"}
                                opacity={lbl.opacity}
                                letterSpacing={lbl.letterSpacing}
                                textDecoration={lbl.textDecoration}
                                dx={lbl.dx ? lbl.dx / viewbox.zoom : undefined}
                                dy={lbl.dy ? lbl.dy / viewbox.zoom : undefined}
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