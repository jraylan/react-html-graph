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
    /** Retorna o estado runtime atual reportado pelos nós. */
    getNodeStates(): GraphNodeRuntimeState[];
    /** Retorna o estado runtime atual reportado pelos links. */
    getLinkStates(): GraphLinkRuntimeState[];
    /** Centraliza a viewport para enquadrar todos os nós visíveis. */
    centralize(options?: GraphCentralizeOptions): Promise<Viewbox>;
    /** Aplica um algoritmo de layout aos nós do grafo. */
    applyLayout(input: GraphApplyLayoutInput): Promise<GraphLayoutResult>;
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

/** Opções para centralizar a viewport no conteúdo atual do grafo. */
export interface GraphCentralizeOptions {
    /** Espaçamento mínimo em pixels entre o conteúdo e a borda visível. */
    padding?: number;
    /** Zoom mínimo permitido ao enquadrar o conteúdo. */
    minZoom?: number;
    /** Zoom máximo permitido ao enquadrar o conteúdo. */
    maxZoom?: number;
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

/** Entrada pública para aplicar um layout aos nós existentes do grafo. */
export interface GraphApplyLayoutInput {
    /** Nome do algoritmo de layout a executar. */
    algorithm: GraphLayoutAlgorithm;
    /** Opções compartilhadas entre os algoritmos disponíveis. */
    options?: GraphLayoutOptions;
}

/** Modo do grafo (controle de edição vs somente leitura). */
export type GraphMode = "readonly" | "edit";

/** Nome de um algoritmo de layout suportado pelo grafo. */
export type GraphLayoutAlgorithm =
    | "force-direction"
    | "organic"
    | "radial"
    | "sequential"
    | "structural"
    | "tree";

/** Link simplificado usado pelos algoritmos de layout. */
export interface GraphLayoutLink<T = any> {
    /** Identificador único do link. */
    id: string;
    /** Id do nó de origem. */
    from: string;
    /** Id do nó de destino. */
    to: string;
    /** Dados opcionais associados ao link. */
    data?: T;
}

/** Representa um nó com dimensões e posição para cálculo de layout. */
export interface GraphLayoutNode<T = any> {
    /** Identificador único do nó. */
    id: string;
    /** Largura atual do nó em pixels. */
    width: number;
    /** Altura atual do nó em pixels. */
    height: number;
    /** Posição atual do nó no mundo do grafo. */
    position: Point3D;
    /** Dados opcionais associados ao nó. */
    data?: T;
}

/** Parâmetros compartilhados pelas implementações de layout. */
export interface GraphLayoutOptions {
    /** Dimensões disponíveis da viewport ao aplicar o layout. */
    viewport?: { width: number; height: number };
    /** Espaçamento horizontal base entre nós. */
    gapX?: number;
    /** Espaçamento vertical base entre nós. */
    gapY?: number;
    /** Padding aplicado ao normalizar o resultado. */
    padding?: number;
    /** Número de colunas desejado para layouts sequenciais. */
    columns?: number;
    /** Direção preferencial de layouts hierárquicos. */
    direction?: "LR" | "RL" | "TB" | "BT";
    /** Quantidade de iterações para layouts iterativos. */
    iterations?: number;
    /** Distância radial entre camadas. */
    radiusStep?: number;
    /** Centro alvo opcional para normalização do resultado. */
    center?: { x: number; y: number };
}

/** Entrada comum compartilhada pelos algoritmos na pasta `layouts/`. */
export interface GraphLayoutInput<NodeData = any, LinkData = any> {
    /** Snapshot dos nós a serem organizados. */
    nodes: GraphLayoutNode<NodeData>[];
    /** Snapshot dos links que conectam os nós. */
    links: GraphLayoutLink<LinkData>[];
    /** Opções opcionais para ajuste fino do algoritmo. */
    options?: GraphLayoutOptions;
}

/** Posição final calculada para um nó específico. */
export interface GraphLayoutPosition {
    /** Id do nó reposicionado. */
    id: string;
    /** Nova posição calculada. */
    position: Point3D;
}

/** Resultado de um algoritmo de layout. */
export interface GraphLayoutResult {
    /** Posições calculadas para cada nó do snapshot. */
    positions: GraphLayoutPosition[];
    /** Bounding box total do layout resultante. */
    bounds: { left: number; top: number; width: number; height: number };
}

/** Estado de uma extremidade de link reportado em runtime. */
export interface GraphLinkEndpointState {
    /** Id do nó que contém a porta. */
    nodeId: string;
    /** Id da porta vinculada. */
    portId: string;
    /** Coordenada X atual no espaço do grafo. */
    x: number;
    /** Coordenada Y atual no espaço do grafo. */
    y: number;
    /** Direção geométrica usada no cálculo do path. */
    direction: "left" | "right" | "top" | "bottom";
}

/** Estado runtime atual de um link renderizado. */
export interface GraphLinkRuntimeState {
    /** Id do link. */
    id: string;
    /** Endpoint de origem calculado. */
    from: GraphLinkEndpointState;
    /** Endpoint de destino calculado. */
    to: GraphLinkEndpointState;
    /** Bounding box corrente do SVG do link. */
    bounds: { left: number; top: number; width: number; height: number };
    /** Indica se o link está inválido/orfão no momento. */
    invalid: boolean;
}

/** Estado runtime atual de um nó renderizado. */
export interface GraphNodeRuntimeState<T = any> {
    /** Id do nó. */
    id: string;
    /** Posição atual do nó. */
    position: Point3D;
    /** Largura medida do nó. */
    width: number;
    /** Altura medida do nó. */
    height: number;
    /** Dados associados ao nó. */
    data?: T;
}

/** Propriedades do componente GraphObject (nó do grafo). */
export interface GraphObjectProps<T = any> {
    /** Identificador único do nó. */
    id: string;
    /** Posição controlada pelo Graph quando disponível. */
    position?: Point3D;
    /** Definições de portas do nó (opcional). */
    ports?: PortDefinition[];
    /** Posição inicial {x,y,z} opcional. */
    initialPosition?: Point3D;
    /** Dados arbitrários associados ao nó. */
    data?: T;
    /** Callback chamado quando o nó é movido. */
    onMove?: (newPosition: Point3D) => void;
    /** Callback chamado quando o nó reporta seu estado runtime atual. */
    onStateChange?: (state: GraphNodeRuntimeState<T>) => void;
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
