# react-html-graph

`react-html-graph` renders graph nodes with HTML and graph links with SVG.

Use it when you want React components for nodes, customizable SVG links, drag-and-drop connections, serialization, and built-in layout algorithms.

## Installation

```bash
npm install react-html-graph react react-dom
```

`react` and `react-dom` are peer dependencies.

## Basic usage

The usual setup is:

1. Create a stable graph API with `useGraphApi()`.
2. Register node types and link templates in `onReady`.
3. Load a snapshot with nodes and links.
4. Render `<Graph api={api} />`.

```tsx
import Graph, {
  BidirectionalPath,
  LinkDefinition,
  NodeDefinition,
  NodeObjectTemplateProps,
  PortRenderProps,
  useGraphApi,
  useLinkInfo,
} from "react-html-graph";

type DeviceData = {
  label: string;
  status: "online" | "offline";
};

type EdgeData = {
  latency: number;
};

function PortHandle(props: PortRenderProps) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: props.canDrop ? "#22c55e" : "#334155",
        border: "2px solid #0f172a",
      }}
    />
  );
}

function DeviceNode({ data, ports }: NodeObjectTemplateProps<DeviceData>) {
  if (!data) return null;

  return (
    <div
      style={{
        position: "relative",
        minWidth: 180,
        padding: 16,
        border: "1px solid #1f2937",
        borderRadius: 12,
        background: "#0b1220",
        color: "#e5e7eb",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {ports.all}
      </div>
      <strong>{data.label}</strong>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{data.status}</div>
    </div>
  );
}

function DefaultLink() {
  const { data, fromAnchor, toAnchor } = useLinkInfo<EdgeData>();

  if (!fromAnchor || !toAnchor) return null;

  return (
    <BidirectionalPath
      from={fromAnchor}
      to={toAnchor}
      width={2}
      spacing={4}
      forwardColor="#22c55e"
      reverseColor="#22c55e"
      labels={
        data
          ? [
              {
                text: `${data.latency}ms`,
                position: 0,
                color: "#ffffff",
                fontSize: 12,
              },
            ]
          : []
      }
    />
  );
}

const snapshot = {
  nodes: [
    {
      id: "router-a",
      nodeType: "device",
      position: { x: 120, y: 120, z: 0 },
      data: { label: "Router A", status: "online" },
    },
    {
      id: "router-b",
      nodeType: "device",
      position: { x: 420, y: 260, z: 0 },
      data: { label: "Router B", status: "online" },
    },
  ] satisfies NodeDefinition<DeviceData>[],
  links: [
    {
      id: "router-a-router-b",
      connectionType: "data",
      from: { node: "router-a", port: "port" },
      to: { node: "router-b", port: "port" },
      data: { latency: 12 },
    },
  ] satisfies LinkDefinition<EdgeData>[],
};

export function NetworkGraph() {
  const api = useGraphApi({
    onReady(graph) {
      graph.registerNodeType("device", {
        ports: [
          {
            id: "port",
            connectionType: "data",
            direction: "bidirectional",
            location: { x: 0, y: 0 },
            children: PortHandle,
          },
        ],
      });

      graph.setDefaultNodeTemplate(DeviceNode);
      graph.setDefaultLinkTemplate(DefaultLink);
      graph.load(snapshot);
    },
  });

  return <Graph api={api} mode="edit" />;
}
```

## Graph component

`Graph` takes a stable API object created by `useGraphApi()`.

```tsx
<Graph api={api} mode="edit" onError={(error) => console.error(error)} />
```

### Props

- `api: GraphApi` — required.
- `mode?: "edit" | "readonly"` — defaults to `"edit"`.
- `onError?: (error: GraphError) => void` — optional error callback.

## Defining node types

Node types describe the ports available for a node and can optionally provide a dedicated template.

```tsx
graph.registerNodeType("device", {
  ports: [
    {
      id: "in",
      connectionType: "data",
      direction: "input",
      location: "left",
      children: PortHandle,
    },
    {
      id: "out",
      connectionType: "data",
      direction: "output",
      location: "right",
      children: PortHandle,
    },
  ],
  template: DeviceNode,
});
```

Each port definition supports:

- `id`
- `connectionType`
- `direction`
- `location`
- `children`
- `onDragEnd` (optional)

Inside a node template, `ports` are grouped by location:

- `ports.top`
- `ports.bottom`
- `ports.left`
- `ports.right`
- `ports.floating`
- `ports.all`

## Rendering links

Link templates can use `useLinkInfo()` to access the current link state, node state, DOM references, resolved anchors, and custom link data.

```tsx
function CustomLink() {
  const { fromAnchor, toAnchor, data } = useLinkInfo<{
    latency: number;
  }>();

  if (!fromAnchor || !toAnchor) return null;

  return (
    <BidirectionalPath
      from={fromAnchor}
      to={toAnchor}
      width={2}
      spacing={4}
      forwardColor="#38bdf8"
      reverseColor="#38bdf8"
      labels={
        data
          ? [
              {
                text: `${data.latency}ms`,
                position: 0,
                color: "#fff",
                fontSize: 12,
              },
            ]
          : []
      }
    />
  );
}

graph.registerLinkTemplate("data", CustomLink);
graph.setDefaultLinkTemplate(CustomLink);
```

If you do not want to use `BidirectionalPath`, return your own SVG elements.

## Loading and serializing graphs

Load data with `api.load()`.

```tsx
api.load({
  nodes: [{ id: "a", nodeType: "device", position: { x: 0, y: 0, z: 0 } }],
  links: [],
});
```

Serialize the current graph state with `api.serialize()`.

```tsx
const snapshot = api.serialize();
```

This includes the current runtime node positions.

## Working with the API

The main methods exposed by `GraphApi` are:

- `addNode(node)`
- `removeNode(id)`
- `addLink(link)`
- `removeLink(id)`
- `connect(connection)`
- `disconnect(connection)`
- `getConnections()`
- `getNodeStates()`
- `getLinkStates()`
- `centralize(options?)`
- `applyLayout(input)`
- `serialize()`
- `load(input)`
- `registerNodeType(name, definition)`
- `setDefaultNodeTemplate(template)`
- `registerLinkTemplate(connectionType, template)`
- `setDefaultLinkTemplate(template)`

Example:

```tsx
await api.applyLayout({
  algorithm: "tree",
  options: {
    padding: 56,
    gapX: 84,
    gapY: 72,
  },
});

await api.centralize({ padding: 40 });
```

## Built-in layout algorithms

Available algorithms:

- `"tree"` — tree layout with parent nodes centered over their children.
- `"structural"` — hierarchical layout based on graph connectivity.
- `"force-direction"` — force layout with directional bias.
- `"organic"` — force layout seeded from a radial arrangement.
- `"radial"` — radial layout around a root.
- `"sequential"` — sequential grid-like layout.

You can also import the standalone layout helpers directly:

```tsx
import {
  calculateLayout,
  calculateFitView,
  configureWorkerPool,
} from "react-html-graph";
```

## Hooks and lower-level exports

The package also exports lower-level pieces when you need more control:

- `useGraphApi()`
- `useLinkInfo()`
- `useGraphItems()`
- `useGraphMode()`
- `useGraphRoot()`
- `useViewbox()`
- `useConnectionApi()`
- `useConnections()`
- `usePortDrag()`
- `usePortDrop()`
- `GraphObject`
- `GraphPort`
- `GraphLink`
- `BidirectionalPath`

For most applications, start with `Graph`, `useGraphApi`, `registerNodeType`, and a default link template.

## Notes

- Nodes are rendered as HTML elements.
- Links are rendered as SVG.
- `mode="readonly"` disables editing interactions.
- Layout and path calculations run in a worker pool.
- `configureWorkerPool(size)` must be called before the first calculation if you want to override the default worker count.

## License

MIT
