import { memo, useRef } from "react";
import { GraphLinkProps, LinkInfoContextValue } from "../types";
import LinkInfoProvider from "../providers/link-info-provider";
import useLinkInfo from "../hooks/link-info";


/**
 * Componente de composição que envolve o conteúdo do link em um
 * LinkInfoProvider e delega a renderização para a função template.
 * O template recebe as informações do link via LinkInfoContext.
 */
const MemoizedGraphLink = memo(function GraphLink({
    id,
    from,
    to,
    onStateChange,
    template,
    data,
}: GraphLinkProps) {
    const linkRef = useRef<HTMLDivElement>(null!);
    return (
        <node-graph-link
            ref={linkRef}
            link-id={id}
            from-node={from.node}
            to-node={to.node}
            from-port={from.port}
            to-port={to.port}
        >
            <LinkInfoProvider
                id={id}
                from={from}
                to={to}
                onStateChange={onStateChange}
                data={data}
                rootRef={linkRef}
            >
                <LinkContent template={template} />
            </LinkInfoProvider>
        </node-graph-link>
    );
});

/**
 * Componente auxiliar que consome o LinkInfoContext e passa
 * os dados para a função template do link.
 */

function LinkContent({ template }: { template: (props: LinkInfoContextValue) => React.ReactNode }) {
    const linkInfo = useLinkInfo();
    return <>{template(linkInfo)}</>;
}

export default MemoizedGraphLink;
