import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { ConnectionContext } from "../context/connection-context";
import useLinkAnchors from "../hooks/link-anchors";
import useMathProvider from "../hooks/math-provider";
import useNodeRegistry from "../hooks/node-registry";
import useViewbox from "../hooks/viewbox";
import { TempLinkInfoContextValue, TempLinkProps } from "../types";
import { buildCursorAnchor, buildLinkAnchor } from "../utils/link-geometry";

const TEMP_LINK_PATH_STEPS = 5;


/**
 * Componente que renderiza um link temporário enquanto o usuário arrasta uma
 * conexão entre portas. Desenha uma curva quadrática entre a posição da porta
 * origem e o cursor.
 *
 * @returns JSX.Element | null
 */
export default function TempLink(props: TempLinkProps) {
    return (
        <node-graph-temp-link>
            {props.template
                ? <TempLinkTemplateContent template={props.template} data={props.data} />
                : <DefaultTempLinkPath />}
        </node-graph-temp-link>
    );
}

function TempLinkTemplateContent(props: Required<Pick<TempLinkProps, "template">> & Pick<TempLinkProps, "data">) {
    const { getTempLinkState, subscribeTempLink } = useContext(ConnectionContext);
    const registry = useNodeRegistry();
    const dragState = useSyncExternalStore(subscribeTempLink, getTempLinkState, getTempLinkState);

    const source = dragState.active
        ? { node: dragState.sourceNodeId, port: dragState.sourcePortID }
        : { node: "", port: "" };
    const target = dragState.active && dragState.targetNodeId && dragState.targetPortID
        ? { node: dragState.targetNodeId, port: dragState.targetPortID }
        : undefined;
    const { fromAnchor, toAnchor, fromNodeState, toNodeState, } = useLinkAnchors({
        from: source,
        to: target,
        cursorPosition: dragState.active ? dragState.cursorPosition : undefined,
        reportOrphans: false,
    });

    if (!dragState.active) return null;

    const info: TempLinkInfoContextValue = {
        from: source,
        to: target,
        fromAnchor,
        toAnchor,
        fromNode: registry.getNodeElement(dragState.sourceNodeId),
        fromPort: registry.getPortElement(dragState.sourceNodeId, dragState.sourcePortID),
        toNode: target ? registry.getNodeElement(target.node) : null,
        toPort: target ? registry.getPortElement(target.node, target.port) : null,
        fromNodeState,
        toNodeState,
        data: props.data,
    };

    return <>{props.template(info)}</>;
}

function DefaultTempLinkPath() {
    const { getTempLinkState, subscribeTempLink, getPortRegistration } = useContext(ConnectionContext);
    const registry = useNodeRegistry();
    const viewbox = useViewbox();
    const mathProvider = useMathProvider();
    const rootRef = useRef<SVGSVGElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const calcVersionRef = useRef(0);

    const clearPath = useCallback(() => {
        const root = rootRef.current;
        const path = pathRef.current;
        if (!root || !path) return;

        calcVersionRef.current += 1;
        path.setAttribute("d", "");
        root.style.left = "0px";
        root.style.top = "0px";
        root.style.width = "0px";
        root.style.height = "0px";
        root.removeAttribute("viewBox");
    }, []);

    const redraw = useCallback(() => {
        const root = rootRef.current;
        const path = pathRef.current;
        if (!root || !path) return;

        const dragState = getTempLinkState();
        if (!dragState.active) {
            clearPath();
            return;
        }

        const fromNodeState = registry.getNodeState(dragState.sourceNodeId);
        const fromPortRegistration = getPortRegistration(dragState.sourceNodeId, dragState.sourcePortID);
        const fromAnchor = buildLinkAnchor(fromNodeState, fromPortRegistration?.location);
        const toAnchor = dragState.targetNodeId && dragState.targetPortID
            ? buildLinkAnchor(
                registry.getNodeState(dragState.targetNodeId),
                getPortRegistration(dragState.targetNodeId, dragState.targetPortID)?.location,
            )
            : buildCursorAnchor(dragState.cursorPosition);

        if (!fromAnchor || !toAnchor) {
            clearPath();
            return;
        }

        const version = ++calcVersionRef.current;
        mathProvider.calculatePath({
            fromX: fromAnchor.x,
            fromY: fromAnchor.y,
            toX: toAnchor.x,
            toY: toAnchor.y,
            fromVector: fromAnchor.d,
            toVector: toAnchor.d,
            steps: TEMP_LINK_PATH_STEPS,
        }).then(result => {
            if (version !== calcVersionRef.current) return;

            root.style.left = result.bounds.left + "px";
            root.style.top = result.bounds.top + "px";
            root.style.width = result.bounds.width + "px";
            root.style.height = result.bounds.height + "px";
            root.setAttribute("viewBox", `${result.bounds.left} ${result.bounds.top} ${result.bounds.width} ${result.bounds.height}`);
            path.setAttribute("d", result.pathD);
        });
    }, [clearPath, getPortRegistration, getTempLinkState, mathProvider, registry]);

    useEffect(() => {
        redraw();
        return subscribeTempLink(redraw);
    }, [redraw, subscribeTempLink]);

    useEffect(() => {
        redraw();
    }, [redraw, viewbox.zoom]);


    return (
        <svg ref={rootRef}>
            <path
                ref={pathRef}
                d=""
                stroke="#888"
                fill="none"
                strokeWidth={3 / viewbox.zoom}
                strokeLinecap="round"
                strokeDasharray={12 / viewbox.zoom}
                style={{
                    animationDuration: "1s",
                    animationDirection: "normal",
                    ["--cycle-len" as string]: 12 / viewbox.zoom + "px",
                }}
            />
        </svg>
    );
}

