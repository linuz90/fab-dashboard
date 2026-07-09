import dynamicIconImports from "lucide-react/dynamicIconImports";

export const LUCIDE_ICON_NAMES = Object.freeze(Object.keys(dynamicIconImports).sort());

const LUCIDE_ICON_NAME_SET = new Set(LUCIDE_ICON_NAMES);

export function isLucideIconName(value: unknown): value is string {
  return typeof value === "string" && LUCIDE_ICON_NAME_SET.has(value);
}
