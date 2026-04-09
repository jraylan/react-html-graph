import { useContext } from "react";
import { GraphContext } from "../context/graph-context";

/**
 * Hook que retorna o modo atual do graph ("readonly" | "edit") a partir
 * do GraphContext.
 *
 * @returns GraphMode
 */
export default function useGraphMode() {
    const { mode } = useContext(GraphContext);
    return mode;
}
