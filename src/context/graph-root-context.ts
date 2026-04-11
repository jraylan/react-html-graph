import { createContext } from "react";

/**
 * Contexto que fornece a ref do elemento raiz (graph-root) do grafo.
 * Permite que componentes internos façam querySelector no escopo
 * correto, possibilitando múltiplas instâncias do graph na mesma página.
 */
export const GraphRootContext = createContext<React.RefObject<HTMLElement | null>>({ current: null });
