import { createContext, useContext, type ReactNode } from "react";

export type CardInteractionMode = "dashboard" | "preview";

const CardInteractionModeContext = createContext<CardInteractionMode>("dashboard");

export function CardInteractionModeProvider({
  mode,
  children,
}: {
  mode: CardInteractionMode;
  children: ReactNode;
}) {
  return <CardInteractionModeContext.Provider value={mode}>{children}</CardInteractionModeContext.Provider>;
}

export function useCardInteractionMode(): CardInteractionMode {
  return useContext(CardInteractionModeContext);
}
