import { useRef } from "react";
import type {
    GraphApi,
    NodeTypeDefinition,
    NodeDefinition,
    LinkDefinition,
    PortConnection,
    GraphNodeRuntimeState,
    GraphLinkRuntimeState,
    GraphCentralizeOptions,
    GraphApplyLayoutInput,
    GraphLayoutResult,
    Viewbox,
    NodeObjectTemplateProps,
    LinkInfoContextValue,
    GraphSerializedState,
} from "../types";


/** Implementação interna que estende GraphApi com campos de controle. */
export interface GraphApiInternal extends GraphApi {
    /** Registro de tipos de nó (nodeType → definição). */
    _nodeTypeRegistry: Map<string, NodeTypeDefinition>;
    /** Registro de templates de link (connectionType → template). */
    _linkTemplateRegistry: Map<string, (props: LinkInfoContextValue) => React.ReactNode>;
    /** Template padrão para nós sem tipo registrado. */
    _defaultNodeTemplate: ((props: NodeObjectTemplateProps) => React.ReactNode) | null;
    /** Template padrão para links sem tipo registrado. */
    _defaultLinkTemplate: ((props: LinkInfoContextValue) => React.ReactNode) | null;
    /** Indica se o Graph já se conectou. */
    _connected: boolean;
    /** Callback chamado quando o Graph conecta. */
    _onReady: ((api: GraphApi) => void) | null;
    /** Vincula implementações reais vindas do Graph. */
    _bind(impl: GraphApiBindings): void;
    /** Desvincula implementações ao desmontar o Graph. */
    _unbind(): void;
}

/** Métodos injetados pelo Graph via _bind. */
export interface GraphApiBindings {
    addNode(node: NodeDefinition): void;
    removeNode(id: string): void;
    addLink(link: LinkDefinition): void;
    removeLink(id: string): void;
    connect(connection: PortConnection): void;
    disconnect(connection: PortConnection): void;
    getConnections(): PortConnection[];
    getNodeStates(): GraphNodeRuntimeState[];
    getLinkStates(): GraphLinkRuntimeState[];
    centralize(options?: GraphCentralizeOptions): Promise<Viewbox>;
    applyLayout(input: GraphApplyLayoutInput): Promise<GraphLayoutResult>;
    serialize(): GraphSerializedState;
    deserialize(input: GraphSerializedState | string): void;
}

export interface UseGraphApiOptions {
    /** Chamado uma vez quando o Graph monta e conecta a API. */
    onReady?: (api: GraphApi) => void;
}

/** No-op para métodos ainda não conectados. */
const NOOP = () => { };
const NOOP_ARRAY = () => [] as any[];
const NOOP_PROMISE = () => Promise.resolve({} as any);
const NOOP_SERIALIZE = () => ({ nodes: [], links: [] } as GraphSerializedState);

function createGraphApiInternal(onReady: ((api: GraphApi) => void) | null): GraphApiInternal {
    const nodeTypeRegistry = new Map<string, NodeTypeDefinition>();
    const linkTemplateRegistry = new Map<string, (props: LinkInfoContextValue) => React.ReactNode>();

    const api: GraphApiInternal = {
        // Registros — funcionam imediatamente
        _nodeTypeRegistry: nodeTypeRegistry,
        _linkTemplateRegistry: linkTemplateRegistry,
        _defaultNodeTemplate: null,
        _defaultLinkTemplate: null,
        _connected: false,
        _onReady: onReady,

        registerNodeType(name: string, definition: NodeTypeDefinition) {
            nodeTypeRegistry.set(name, definition);
        },
        setDefaultNodeTemplate(template: (props: NodeObjectTemplateProps) => React.ReactNode) {
            api._defaultNodeTemplate = template;
        },
        registerLinkTemplate(connectionType: string, template: (props: LinkInfoContextValue) => React.ReactNode) {
            linkTemplateRegistry.set(connectionType, template);
        },
        setDefaultLinkTemplate(template: (props: LinkInfoContextValue) => React.ReactNode) {
            api._defaultLinkTemplate = template;
        },

        // Métodos de manipulação — no-ops até _bind
        addNode: NOOP,
        removeNode: NOOP,
        addLink: NOOP,
        removeLink: NOOP,
        connect: NOOP,
        disconnect: NOOP,
        getConnections: NOOP_ARRAY,
        getNodeStates: NOOP_ARRAY,
        getLinkStates: NOOP_ARRAY,
        centralize: NOOP_PROMISE,
        applyLayout: NOOP_PROMISE,
        serialize: NOOP_SERIALIZE,
        deserialize: NOOP,

        _bind(impl: GraphApiBindings) {
            api.addNode = impl.addNode;
            api.removeNode = impl.removeNode;
            api.addLink = impl.addLink;
            api.removeLink = impl.removeLink;
            api.connect = impl.connect;
            api.disconnect = impl.disconnect;
            api.getConnections = impl.getConnections;
            api.getNodeStates = impl.getNodeStates;
            api.getLinkStates = impl.getLinkStates;
            api.centralize = impl.centralize;
            api.applyLayout = impl.applyLayout;
            api.serialize = impl.serialize;
            api.deserialize = impl.deserialize;

            if (!api._connected) {
                api._connected = true;
                api._onReady?.(api);
            }
        },

        _unbind() {
            api._connected = false;
            api.addNode = NOOP;
            api.removeNode = NOOP;
            api.addLink = NOOP;
            api.removeLink = NOOP;
            api.connect = NOOP;
            api.disconnect = NOOP;
            api.getConnections = NOOP_ARRAY;
            api.getNodeStates = NOOP_ARRAY;
            api.getLinkStates = NOOP_ARRAY;
            api.centralize = NOOP_PROMISE;
            api.applyLayout = NOOP_PROMISE;
            api.serialize = NOOP_SERIALIZE;
            api.deserialize = NOOP;
        },
    };

    return api;
}

/**
 * Hook que cria um objeto de API estável para o grafo.
 * O objeto retornado nunca muda de identidade — métodos de manipulação
 * são no-ops até que o componente <Graph> monte e chame _bind internamente.
 *
 * @param options Opções de configuração (onReady callback).
 * @returns Instância estável de GraphApi.
 */
export default function useGraphApi(options?: UseGraphApiOptions): GraphApi {
    const apiRef = useRef<GraphApiInternal>(null);
    if (!apiRef.current) {
        apiRef.current = createGraphApiInternal(options?.onReady ?? null);
    }
    return apiRef.current;
}
