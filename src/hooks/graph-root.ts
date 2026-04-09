import { useContext } from "react";
import { GraphRootContext } from "../context/graph-root-context";

/**
 * Hook que retorna a ref do elemento raiz (graph-root) desta árvore.
 * Todos os querySelector devem ser feitos nesse elemento para suportar
 * múltiplas instâncias do graph na mesma página.
 *
 * @returns React.RefObject<HTMLElement | null>
 */
export default function useGraphRoot() {
    return useContext(GraphRootContext);
}
