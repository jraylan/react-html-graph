import { useRef, useEffect } from "react";
import useGraphItems from "../hooks/graph";
import useViewbox from "../hooks/viewbox";
import TempLink from "../link/temp-link";
import useGraphMode from "../hooks/graph-mode";


/**
 * Componente ViewBox responsável por aplicar a transformação de escala e
 * translação do graph com base no estado do viewbox. Renderiza nós, links
 * e o componente temporário de link quando em modo de edição.
 *
 * @returns JSX.Element
 */
export default function ViewBox() {
    const ref = useRef<HTMLDivElement>(null)
    const viewbox = useViewbox();
    const mode = useGraphMode();
    const { nodes, links } = useGraphItems();

    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.transform = [
            `scale(${viewbox.zoom})`,
            `translate(${-viewbox.x}px, ${-viewbox.y}px)`,
        ].join(' ')
        ref.current.style.transformOrigin = '0 0';
    }, [viewbox])

    return (
        <graph-viewbox ref={ref}>
            {links}
            {nodes}
            {mode === 'edit' && <TempLink />}
        </graph-viewbox>
    )

}