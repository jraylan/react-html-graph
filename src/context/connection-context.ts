import { createContext } from "react";
import { ConnectionContextProps } from "../types";


export const ConnectionContext = createContext<ConnectionContextProps>({
    connections: [],
    portRegistryVersion: 0,
    dragState: { active: false },
    getGraphApi: () => null,
    connect: () => { },
    disconnect: () => { },
    startDrag: () => { },
    dragOverPort: () => { },
    dragLeavePort: () => { },
    endDrag: () => { },
    registerPort: () => { },
    getPortRegistration: () => null,
    getTempLinkState: () => ({ active: false }),
    subscribeTempLink: () => () => { },
    unregisterPort: () => { },
});
