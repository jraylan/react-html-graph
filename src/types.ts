/**
 * Tipos compartilhados do projeto (ordenados alfabeticamente).
 *
 * Observações:
 * - Tipos que representam objetos foram convertidos para `interface` quando
 *   aplicável, conforme solicitado.
 * - Comentários de propriedade foram mantidos inline (acima de cada campo),
 *   sem uso de @property.
 */

/** API imperativa para manipular conexões no grafo. */
export interface ConnectionApi {
    /** Adiciona uma conexão. */
    connect(connection: PortConnection): void;
    /** Remove uma conexão. */
    disconnect(connection: PortConnection): void;
    /** Retorna o array de conexões atuais. */
    getConnections(): PortConnection[];
}

/** Estado e operações expostas pelo contexto de conexões. */
export interface ConnectionContextProps {
    /** Lista de conexões no grafo. */
    connections: PortConnection[];
    /** Estado do arraste entre portas. */
    dragState: DragState;
    /** Retorna a instância atual da API imperativa do grafo. */
    getGraphApi(): GraphApi | null;
    /** Adiciona uma conexão. */
    connect(connection: PortConnection): void;
    /** Remove uma conexão. */
    disconnect(connection: PortConnection): void;
    /** Inicia o arraste a partir de uma porta (source). */
    startDrag(sourceNodeId: string, sourcePortName: string, connectionType: ConnectionType): void;
    /** Finaliza o arraste (pode incluir target ou apenas cancelar). */
    endDrag(targetNodeId?: string, targetPortName?: string, cursorPosition?: { x: number; y: number }): void;
    /** Registra uma porta disponível para conexão. */
    registerPort(registration: PortRegistration): void;
    /** Remove o registro de uma porta. */
    unregisterPort(nodeId: string, portName: string): void;
}

/** Propriedades do provider que expõe a API do grafo via ref. */
export interface ConnectionProviderProps {
    /** Ref mutável que receberá a instância de GraphApi. */
    graphApiRef: React.RefObject<GraphApi | null>;
    /** Elementos filhos renderizados pelo provider. */
    children: React.ReactNode;
}

/** Identificador textual do tipo de conexão (ex.: "data"). */
export type ConnectionType = string;

/** Estado do fluxo de arraste entre portas. */
export type DragState =
    | { active: false }
    | {
        active: true;
        /** Id do nó de origem do arraste. */
        sourceNodeId: string;
        /** Nome da porta de origem do arraste. */
        sourcePortName: string;
        /** Tipo de conexão sendo arrastada. */
        connectionType: ConnectionType;
        /** Posição do cursor no momento (coordenadas do mundo). */
        cursorPosition: { x: number; y: number };
    };

/** Interface do contexto de erros. */
export interface ErrorContextProps {
    /** Reporta um erro de grafo (código, mensagem e detalhes opcionais). */
    reportError(error: GraphError): void;
}

/** API imperativa do grafo (usada por refs para manipular nós/links). */
export interface GraphApi {
    addNode(node: NodeDefinition): void;
    removeNode(id: string): void;
    addLink(link: LinkDefinition): void;
    removeLink(id: string): void;
    connect(connection: PortConnection): void;
    disconnect(connection: PortConnection): void;
    getConnections(): PortConnection[];
}

/** Estado do viewbox — posição e escala do canvas. */
export interface Viewbox {
    /** Coordenada X do canto superior esquerdo no espaço do mundo. */
    x: number;
    /** Coordenada Y do canto superior esquerdo no espaço do mundo. */
    y: number;
    /** Largura atual da área visível em pixels. */
    width: number;
    /** Altura atual da área visível em pixels. */
    height: number;
    /** Fator de zoom aplicado. */
    zoom: number;
}

/** Informação básica de um evento de porta (subset das props da porta). */
export interface GraphInfo {
    type: ConnectionType;
    id: string;
    nodeId: string;
    direction: "input" | "output" | "bidirectional";
}

/** Representa um erro interno do grafo. */
export interface GraphError {
    /** Código identificador do erro. */
    code: string;
    /** Mensagem legível para depuração/log. */
    message: string;
    /** Dados adicionais opcionais relacionados ao erro. */
    details?: Record<string, unknown>;
}


/** Propriedades do componente Graph. */
export type GraphProps = {
    /** Modo do grafo (controle de edição vs somente leitura). */
    mode?: GraphMode;
    /** Callback chamado quando ocorre um erro no grafo. */
    onError?: (error: GraphError) => void;
    /** Ref para acessar a api (GraphApi). */
    ref?: React.Ref<GraphApi>;
}

/** Modo do grafo (controle de edição vs somente leitura). */
export type GraphMode = "readonly" | "edit";

/** Propriedades do componente GraphObject (nó do grafo). */
export interface GraphObjectProps<T = any> {
    /** Identificador único do nó. */
    id: string;
    /** Definições de portas do nó (opcional). */
    ports?: PortDefinition[];
    /** Posição inicial {x,y,z} opcional. */
    initialPosition?: Point3D;
    /** Dados arbitrários associados ao nó. */
    data?: T;
    /** Callback chamado quando o nó é movido. */
    onMove?: (newPosition: Point3D) => void;
    /** Função que renderiza o conteúdo do nó com as portas. */
    children(props: NodeObjectTemplateProps<T>): React.ReactNode;
}

/** Evento disparado ao clicar em uma porta do grafo. */
export interface GraphPortClickEvent {
    readonly type: 'click';
    readonly graph: GraphInfo;
    readonly nativeEvent: React.MouseEvent['nativeEvent'];
    readonly api: GraphApi;
}

/** Evento disparado quando o mouse sai de cima de uma porta. */
export interface GraphPortMouseLeaveEvent {
    readonly type: 'mouseLeave';
    readonly graph: GraphInfo;
    readonly nativeEvent: React.MouseEvent['nativeEvent'];
    readonly api: GraphApi;
}

/** Evento disparado quando o mouse entra sobre uma porta. */
export interface GraphPortMouseOverEvent {
    readonly type: 'mouseOver';
    readonly graph: GraphInfo;
    readonly nativeEvent: React.MouseEvent['nativeEvent'];
    readonly api: GraphApi;
}

/** Propriedades de um componente de porta no grafo. */
export interface GraphPortProps {
    /** Tipo da conexão suportada pela porta. */
    type: ConnectionType;
    /** Identificador da porta. */
    id: string;
    /** Identificador do nó que contém a porta. */
    nodeId: string;
    /** Direção da porta. */
    direction: "input" | "output" | "bidirectional";
    /** Localização ou coordenadas da porta no nó. */
    location: { x: number; y: number } | "top" | "bottom" | "left" | "right";
    /** Callback opcional chamado ao terminar um arraste. */
    onDragEnd?: (api: GraphApi, event: PortDragEndEvent) => Promise<void>;
    /** Render function para a UI da porta. */
    children: (props: PortRenderProps) => React.ReactNode;
    /** Event callback de clique. */
    onClick?: (event: GraphPortClickEvent) => void;
    /** Event callback de mouse over. */
    onMouseOver?: (event: GraphPortMouseOverEvent) => void;
    /** Event callback de mouse leave. */
    onMouseLeave?: (event: GraphPortMouseLeaveEvent) => void;
}

/** Definição de um link (conexão visual) entre dois nós. */
export interface LinkDefinition<T = any> {
    /** Identificador único do link. */
    id: string;
    /** Ponto de origem { node, port }. */
    from: { node: string; port: string };
    /** Ponto de destino { node, port }. */
    to: { node: string; port: string };
    /** Espessura do link (opcional). */
    width?: number;
    /** Espessura do fluxo forward (opcional). */
    forwardWidth?: number;
    /** Espessura do fluxo reverse (opcional). */
    reverseWidth?: number;
    /** Espaçamento entre fluxos forward/reverse (opcional). */
    spacing?: number;
    /** Dados arbitrários associados ao link (opcional). */
    data?: T;
    /** Rótulos do link (opcional). */
    labels?: LinkLabel[];
    /** Cor do fluxo forward. */
    forwardColor?: string;
    /** Cor do fluxo reverse. */
    reverseColor?: string;
    /** Tamanho do traço para stroke dash (opcional). */
    dashSize?: number;
    /** Espaço entre traços (opcional). */
    gapSize?: number;
    /** Duração da animação do fluxo forward (s). */
    forwardDuration?: number;
    /** Duração da animação do fluxo reverse (s). */
    reverseDuration?: number;
}

/**
 * Tipos possíveis de label para links.
 * Existem duas formas: labels direcionais (forward/reverse) com 'offset'
 * ou labels posicionais (start/middle/end) com dx/dy para deslocamento.
 */
export type LinkLabel =
    | (LinkLabelBase & {
        textAnchor: "forward" | "reverse";
        offset?: number;
        dy?: never;
        dx?: never;
    })
    | (LinkLabelBase & {
        textAnchor?: "start" | "middle" | "end";
        offset?: never;
        dy?: number;
        dx?: number;
    });

/** Estrutura base comum a todos os LinkLabel. */
interface LinkLabelBase {
    text: string;
    position?: number;
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    opacity?: number;
    letterSpacing?: number;
    textDecoration?: string;
}

/** Definição de um nó para uso via API imperativa. */
export interface NodeDefinition<T = any> {
    id: string;
    ports?: PortDefinition[];
    data?: T;
    position: Point3D;
    template: (props: NodeObjectTemplateProps<T>) => React.ReactNode;
}

/** Props passadas ao template do nó (usadas para renderizar portas e conteúdo). */
export interface NodeObjectTemplateProps<T = any> {
    id: string;
    ports: PortsByLocation;
    data: T;
}

/** Ponto 3D simples. */
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

/** Conexão entre duas portas (modelo lógico). */
export interface PortConnection {
    connectionType: ConnectionType;
    from: { nodeId: string; portName: string };
    to: { nodeId: string; portName: string };
}

/** Definição de uma porta em um nó. */
export interface PortDefinition {
    id: string;
    type: ConnectionType;
    direction: "input" | "output" | "bidirectional";
    location: { x: number; y: number } | "top" | "bottom" | "left" | "right";
    onDragEnd?: (api: ConnectionApi, event: PortDragEndEvent) => Promise<void>;
    children: (props: PortRenderProps) => React.ReactNode;
}

/** Evento disparado quando um arraste termina. Fornece contexto de source/target. */
export interface PortDragEndEvent {
    sourceNodeId: string;
    sourcePortName: string;
    connectionType: ConnectionType;
    targetNodeId?: string;
    targetPortName?: string;
    cursorPosition: { x: number; y: number };
}

/** Registro de uma porta no provedor de conexões. */
export interface PortRegistration {
    nodeId: string;
    portName: string;
    connectionType: ConnectionType;
    direction: "input" | "output" | "bidirectional";
    onDragEnd?: (api: GraphApi, event: PortDragEndEvent) => Promise<void>;
}

/** Propriedades passadas para renderização das portas (UI). */
export interface PortRenderProps {
    type: ConnectionType;
    id: string;
    nodeId: string;
    direction: "input" | "output" | "bidirectional";
    location: { x: number; y: number } | "top" | "bottom" | "left" | "right";
    isDragging: boolean;
    canDrop: boolean;
    canDrag: boolean;
}

/** Estrutura que agrupa portas por localização para facilitar renderização. */
export interface PortsByLocation {
    top: React.ReactNode[];
    bottom: React.ReactNode[];
    left: React.ReactNode[];
    right: React.ReactNode[];
    floating: React.ReactNode[];
    all: React.ReactNode[];
}

/** Propriedades do contexto global do grafo (viewbox, nós, links e modo). */
export interface GraphContextProps {
    viewbox: Viewbox;
    nodes: React.ReactNode[];
    links: React.ReactNode[];
    mode: GraphMode;
}
