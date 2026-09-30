import type { ReactNode } from "react";
import { UiVersionContext } from "@/components/v2/ui-version";

const V2_ONLY_CONTEXT = { version: "v2" as const };

export function UiVersionProvider({ children }: { children: ReactNode }) {
  return <UiVersionContext.Provider value={V2_ONLY_CONTEXT}>{children}</UiVersionContext.Provider>;
}
