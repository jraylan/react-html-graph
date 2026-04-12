import { useContext, useRef, useSyncExternalStore } from "react";
import { ConnectionContext } from "../context/connection-context";
import useLinkAnchors from "../hooks/link-anchors";
import useNodeRegistry from "../hooks/node-registry";
import { TempLinkInfoContextValue, TempLinkProps } from "../types";
import UnidirectionalPath from "../paths/unidirectional-path";


/**
 * Componente que renderiza um link temporário enquanto o usuário arrasta uma
 * conexão entre portas. Desenha uma curva quadrática entre a posição da porta
 * origem e o cursor.
 *
 * @returns JSX.Element | null
 */
export default function TempLink(props: TempLinkProps) {
    const rootRef = useRef<HTMLDivElement>(null!);
    return (
        <node-graph-temp-link ref={rootRef}>
            <TempLinkTemplateContent rootRef={rootRef} template={props.template} data={props.data} />
        </node-graph-temp-link>
    );
}

function TempLinkTemplateContent({ rootRef, template, ...props }: { rootRef: React.RefObject<HTMLDivElement> } & Pick<TempLinkProps, "template"> & Pick<TempLinkProps, "data">) {
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

    if (!dragState.active || !fromAnchor || !toAnchor) return null;

    if (template) {
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

        return template(info);
    }

    return (
        <UnidirectionalPath
            rootRef={rootRef} from={fromAnchor} to={toAnchor} />
    );
}

