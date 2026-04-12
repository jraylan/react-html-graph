import { createContext } from "react";
import type { MathProvider } from "../calculations/types";

export const MathProviderContext = createContext<MathProvider | null>(null);
