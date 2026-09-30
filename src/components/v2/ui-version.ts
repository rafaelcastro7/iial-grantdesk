import { createContext, useContext } from "react";

export type UiVersion = "v1" | "v2";

export type UiVersionContextValue = {
  version: UiVersion;
};

export const UiVersionContext = createContext<UiVersionContextValue | null>(null);

export function useUiVersion() {
  const context = useContext(UiVersionContext);
  if (!context) {
    throw new Error("useUiVersion must be used within UiVersionProvider");
  }
  return context;
}
