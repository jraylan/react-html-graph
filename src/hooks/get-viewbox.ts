import { useCallback, useEffect, useRef } from "react";
import useViewbox from "./viewbox";
import { Viewbox } from "../types";


/**
 * Hook que retorna um getter estável para o viewbox atual, sem causar
 * re-render quando o viewbox muda. Mesma abordagem de `useGetZoom`.
 *
 * @returns Função que retorna o Viewbox mais recente.
 */
export default function useGetViewbox() {
    const viewbox = useViewbox();
    const ref = useRef<Viewbox>(viewbox);

    useEffect(() => {
        ref.current = viewbox;
    }, [viewbox]);

    const getViewbox = useCallback(() => {
        return ref.current;
    }, []);

    return getViewbox;
}
