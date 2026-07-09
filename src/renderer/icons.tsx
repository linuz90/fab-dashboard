import type { ComponentProps } from "react";
import { DynamicIcon } from "lucide-react/dynamic";
import { isLucideIconName } from "../shared/lucideIcons";

type DynamicIconProps = ComponentProps<typeof DynamicIcon>;

export function DashboardIcon({
  name,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  name: string | null | undefined;
  className?: string;
  "aria-hidden"?: DynamicIconProps["aria-hidden"];
}) {
  if (!isLucideIconName(name)) return null;
  return <DynamicIcon name={name as DynamicIconProps["name"]} className={className} aria-hidden={ariaHidden} />;
}
