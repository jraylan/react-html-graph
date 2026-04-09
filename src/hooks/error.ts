import { useContext, useCallback } from "react";
import { ErrorContext } from "../context/error-context";

/**
 * Hook que fornece uma função utilitária para reportar erros de grafo
 * usando o ErrorContext.
 *
 * @returns {{ reportError: (code: string, message: string, details?: Record<string, unknown>) => void }}
 */
export default function useGraphError() {
    const { reportError } = useContext(ErrorContext);

    const report = useCallback(
        (code: string, message: string, details?: Record<string, unknown>) => {
            reportError({ code, message, details });
        },
        [reportError]
    );

    return { reportError: report };
}
