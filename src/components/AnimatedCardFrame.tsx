import { BorderBeam } from "border-beam";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { themeFrameShape, themeRefreshPalette } from "../shared/themes";

interface AnimatedCardFrameProps {
  children: ReactNode;
  enter: boolean;
  refreshActive: boolean;
  enterDelayMs: number;
}

/** Owns decorative card motion so individual cards stay focused on data UI.
 * The refresh beam is deliberately quiet: source labels and the refresh icon
 * carry the functional state, while this adds only a faint live edge. */
export function AnimatedCardFrame({ children, enter, refreshActive, enterDelayMs }: AnimatedCardFrameProps) {
  const [theme] = useTheme();
  const squareFrame = themeFrameShape(theme) === "square";
  const refreshPalette = themeRefreshPalette(theme);
  const refreshStrength = refreshPalette === "mono" ? 0.18 : 0.28;

  return (
    <BorderBeam
      active={refreshActive}
      size="line"
      colorVariant={refreshPalette}
      theme="auto"
      staticColors={refreshPalette === "mono"}
      borderRadius={squareFrame ? 0 : undefined}
      brightness={0.9}
      hueRange={8}
      strength={refreshStrength}
      duration={5.2}
      className={cn(
        "dashboard-card-frame",
        enter && "dashboard-card-frame-enter",
        refreshActive && "dashboard-card-frame-refreshing"
      )}
      style={{ "--card-enter-delay": `${enterDelayMs}ms` } as CSSProperties}
    >
      {children}
    </BorderBeam>
  );
}
