import { createContext } from "react";
import { GraphContextProps } from "../types";




export const GraphContext = createContext<GraphContextProps>({
    viewbox: { x: 0, y: 0, width: 0, height: 0, zoom: 0 },
    nodes: [],
    links: [],
    tempLinkTemplate: undefined,
    mode: "edit",
})
