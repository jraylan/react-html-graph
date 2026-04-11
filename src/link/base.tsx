import { memo } from "react";
import { GraphLinkRuntimeState, LinkInfoContextValue } from "../types";
import LinkInfoProvider from "../providers/link-info-provider";
import useLinkInfo from "../hooks/link-info";

type GraphLinkProps<T = any> = {
    id: string;
    from: { node: string; port: string };
    to: { node: string; port: string };
    data?: T;
    onStateChange?: (state: GraphLinkRuntimeState) => void;
    /** Função de renderização do conteúdo visual do link. */
    template: (props: LinkInfoContextValue) => React.ReactNode;
};

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
    return (
        <node-graph-link>
            <LinkInfoProvider id={id} from={from} to={to} onStateChange={onStateChange} data={data}>
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
