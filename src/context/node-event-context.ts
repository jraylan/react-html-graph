import { createContext } from "react";
import type {
    NodeEventContextValue,
} from "../types";
import { NoProviderSymbol } from "../utils/symbols";

const NoContextValue = {
    addEventListener: () => { },
    removeEventListener: () => { },
    [NoProviderSymbol]: true,
};

/** */
export const NodeEventContext = createContext<NodeEventContextValue>(NoContextValue);
