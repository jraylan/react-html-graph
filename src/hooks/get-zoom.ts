import { useCallback, useEffect, useRef } from "react";
import useViewbox from "./viewbox";


export default function useGetZoom() {
    const { zoom } = useViewbox();
    const ref = useRef<number>(zoom);

    useEffect(() => {
        ref.current = zoom;
    }, [zoom])

    const getZoom = useCallback(() => {
        return ref.current;
    }, [])

    return getZoom;

}