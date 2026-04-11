import { memo, useCallback, useRef, useEffect } from "react";
import type {
    ConnectionChangeEvent,
    DataChangeEvent,
    GraphMoveEvent,
    GraphNodeSelectionChangeEvent,
    NodeEventCallback,
    NodeEventEmitter,
    NodeEventMap,
    NodeEventProviderProps,
    PortConnection,
} from "../types";
import { createReadonlyProxy } from "../utils/proxy";
import { NodeEventContext } from "../context/node-event-context";

function tryToDispatch<T extends (...args: any) => any>(fn: T, ...args: Parameters<T>): ReturnType<T> | undefined {
    try {
        return fn(...args);
    } catch (error) {
        console.error("Error executing event handler:", error);
    };
}

const EVENT_CLASS_MAP: { [K in keyof NodeEventMap]: new (nodeId: string, payload: Omit<NodeEventMap[K], "type" | "nodeId">) => NodeEventMap[K] } = {
    dataChange: class DataChangeEventImpl<T extends object = any> implements DataChangeEvent<T> {
        readonly type = "dataChange";
        readonly nodeId: string
        readonly data: T
        constructor(nodeId: string, payload: Omit<DataChangeEvent<T>, "type" | "nodeId">) {
            this.nodeId = nodeId;
            this.data = createReadonlyProxy<T>(payload.data);
        }
    },
    move: class GraphMoveEventImpl implements GraphMoveEvent {
        readonly type = "move";
        readonly nodeId: string
        readonly position: { x: number, y: number, z: number }
        constructor(nodeId: string, payload: Omit<GraphMoveEvent, "type" | "nodeId">) {
            this.nodeId = nodeId;
            this.position = createReadonlyProxy(payload.position);
        }

    },
    connectionChange: class ConnectionChangeEventImpl implements ConnectionChangeEvent {
        readonly type = "connectionChange";
        readonly connection: PortConnection;
        readonly nodeId: string;
        readonly action: "connect" | "disconnect";
        constructor(nodeId: string, payload: Omit<ConnectionChangeEvent, "type" | "nodeId">) {
            this.nodeId = nodeId;
            this.connection = createReadonlyProxy<PortConnection>(payload.connection);
            this.action = payload.action;
        }
    },
    select: class GraphNodeSelectionChangeEventImpl implements GraphNodeSelectionChangeEvent {
        readonly type = "select";
        readonly nodeId: string
        readonly selected: boolean;
        constructor(nodeId: string, payload: Omit<GraphNodeSelectionChangeEvent, "type" | "nodeId">) {
            this.nodeId = nodeId;
            this.selected = payload.selected;
        }
    },
};

const MemizedNodeEventProvider = memo(function NodeEventProvider({ children, emitter, nodeId }: NodeEventProviderProps) {

    const eventListeners = useRef<Record<keyof NodeEventMap, Set<NodeEventCallback<keyof NodeEventMap>>>>({} as Record<keyof NodeEventMap, Set<NodeEventCallback<keyof NodeEventMap>>>);

    const addEventListener = useCallback(
        <K extends keyof NodeEventMap = keyof NodeEventMap>(type: K, handler: NodeEventCallback<K>) => {
            if (!eventListeners.current[type]) {
                eventListeners.current[type] = new Set();
            }
            eventListeners.current[type].add(handler as NodeEventCallback<keyof NodeEventMap>);
        }, []);

    const removeEventListener = useCallback(
        <K extends keyof NodeEventMap = keyof NodeEventMap>(type: K, handler: NodeEventCallback<K>) => {
            eventListeners.current[type]?.delete(handler as NodeEventCallback<keyof NodeEventMap>);
        }, []);

    const emitEvent = useCallback<NodeEventEmitter>((type, payload) => {
        const cls = EVENT_CLASS_MAP[type];
        if (!cls) {
            console.warn(`No event class found for event type: ${type}`);
        }
        const event = new cls(nodeId, payload);
        eventListeners.current[type]?.forEach((handler) => {
            tryToDispatch(handler, event);
        });
    }, [nodeId]);


    useEffect(() => {
        emitter(emitEvent);
    }, [emitEvent, emitter]);


    return (
        <NodeEventContext.Provider value={{ addEventListener, removeEventListener }}>
            {children}
        </NodeEventContext.Provider>
    )
})

export const NodeEventProvider = MemizedNodeEventProvider;