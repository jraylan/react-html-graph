import { useContext } from "react";
import { LinkInfoContext } from "../context/link-info-context";
import { LinkInfoContextValue } from "../types";

/** Hook que retorna as informações do link no qual o componente está inserido. */
export default function useLinkInfo<T = any>() {
    return useContext(LinkInfoContext) as LinkInfoContextValue<T>;
}
