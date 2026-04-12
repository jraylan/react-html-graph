import { useRef, useEffectEvent, useEffect } from "react";
import { calculatePath, calculateLabels } from "../calculations";
import { useViewbox } from "../module";
import { GraphLinkAnchor, LinkLabel } from "../types";

export type UnidirectionalPathProps = {
    from: GraphLinkAnchor;
    to: GraphLinkAnchor;
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
    const calcVersionRef = useRef(0);

    // Calcula paths e labels no worker e atualiza DOM diretamente (sem React render)
    const runCalculation = useEffectEvent(() => {
        const root = rootRef.current;
        const p = pRef.current;
        if (!root || !p) return;

        const version = ++calcVersionRef.current;

        const labelInputs = labels?.map(lbl => ({
            position: lbl.position ?? 0,
            offset: lbl.offset ?? 0,
        }));

        const pathPromise = calculatePath({
            fromX: from.x, fromY: from.y,
            toX: to.x, toY: to.y,
            fromVector: from.d,
            toVector: to.d,
            steps: 60,
        });

        const labelsPromise = labelInputs?.length
            ? calculateLabels({
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                fromVector: from.d,
                toVector: to.d,
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
    });

    useEffect(() => {
        runCalculation();
    }, [runCalculation]);

    const pStroke = width / viewbox.zoom;
    const scaledDash = dashSize / viewbox.zoom;
    const cycleLen = scaledDash;

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