import { useContext } from "react";
import { ConnectionContext } from "../context/connection-context";
import { ConnectionApi } from "../types";

/**
 * Hook que expõe a API de conexões do grafo (connect/disconnect/getConnections)
 * a partir do ConnectionContext.
 *
 * @returns ConnectionApi
 */
export default function useConnectionApi(): ConnectionApi {
    const { connect, disconnect, connections } = useContext(ConnectionContext);
    return { connect, disconnect, getConnections: () => connections };
}
