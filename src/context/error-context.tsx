import { createContext } from "react";
import { ErrorContextProps } from "../types";


export const ErrorContext = createContext<ErrorContextProps>({
    reportError: () => { },
});
