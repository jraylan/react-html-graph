import { useContext } from "react";
import { getDefaultMathProvider } from "../calculations";
import { MathProviderContext } from "../context/math-provider-context";
import type { MathProvider } from "../calculations/types";

/**
 * Retorna o provider matemático ativo no grafo atual.
 * Fora de um Graph, cai para o provider padrão baseado em Web Worker.
 */
export default function useMathProvider(): MathProvider {
    return useContext(MathProviderContext) ?? getDefaultMathProvider();
}
