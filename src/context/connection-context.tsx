import { createContext } from "react";
import { ConnectionContextProps } from "../types";


export const ConnectionContext = createContext<ConnectionContextProps>({
    connections: [],
    dragState: { active: false },
    getGraphApi: () => null,
    connect: () => { },
    disconnect: () => { },
    startDrag: () => { },
    endDrag: () => { },
    registerPort: () => { },
    unregisterPort: () => { },
});
