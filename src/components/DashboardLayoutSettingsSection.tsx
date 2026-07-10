import { Loader2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import {
  DASHBOARD_LAYOUT_WIDTH_PRESETS,
  DASHBOARD_LAYOUT_WIDTHS,
  resolveDashboardLayout,
  type DashboardLayoutConfig,
} from "../shared/layout";

export type DashboardLayoutSelection = Required<Pick<DashboardLayoutConfig, "width" | "maxColumns">>;

export function layoutSelectionFromConfig(layout: DashboardLayoutConfig | null | undefined): DashboardLayoutSelection {
  const resolved = resolveDashboardLayout(layout);
  return { width: resolved.width, maxColumns: resolved.maxColumns };
}

export function sameLayoutSelection(a: DashboardLayoutSelection, b: DashboardLayoutSelection): boolean {
  return a.width === b.width && a.maxColumns === b.maxColumns;
}

function SegmentedRadioOption({
  label,
  value,
  checked,
  disabled,
  onKeyDown,
  onSelect,
}: {
  label: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      data-layout-option={value}
      data-layout-selected={checked ? "true" : "false"}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      tabIndex={checked ? 0 : -1}
      className={cn(
        "dashboard-layout-segment flex min-h-7 min-w-0 items-center justify-center rounded-md px-2 font-mono type-ui-xs text-muted transition-colors",
        "focus-visible:outline focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-offset-[-1px] focus-visible:outline-[var(--focus-ring-color)]",
        checked && "bg-card text-fg shadow-sm",
        disabled && "cursor-default opacity-55"
      )}
    >
      {label}
    </button>
  );
}

function SegmentedRadioGroup<T extends string | number>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  disabled: boolean;
  onChange: (next: T) => void;
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  function focusOption(group: HTMLElement, nextValue: T) {
    window.requestAnimationFrame(() => {
      group.querySelector<HTMLButtonElement>(`[data-layout-option="${String(nextValue)}"]`)?.focus();
    });
  }

  function onOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const group = event.currentTarget.parentElement;
    if (!group) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (selectedIndex + 1) % options.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (selectedIndex - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextValue = options[nextIndex]!.value;
    onChange(nextValue);
    focusOption(group, nextValue);
  }

  return (
    <div role="radiogroup" className="dashboard-layout-segments grid grid-cols-4 gap-1 rounded-lg border border-border bg-canvas/35 p-1" aria-label={label}>
      {options.map((option) => (
        <SegmentedRadioOption
          key={String(option.value)}
          label={option.label}
          value={String(option.value)}
          checked={value === option.value}
          disabled={disabled}
          onKeyDown={onOptionKeyDown}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

export function DashboardLayoutSettingsSection({
  value,
  disabled,
  readOnly,
  saving,
  error,
  onChange,
}: {
  value: DashboardLayoutSelection;
  disabled: boolean;
  readOnly: boolean;
  saving: boolean;
  error: string | null;
  onChange: (next: DashboardLayoutSelection) => void;
}) {
  const selectedPreset = DASHBOARD_LAYOUT_WIDTH_PRESETS[value.width];
  const widthOptions = DASHBOARD_LAYOUT_WIDTHS.map((width) => ({
    label: DASHBOARD_LAYOUT_WIDTH_PRESETS[width].label,
    value: width,
  }));
  const columnOptions = [1, 2, 3, 4].map((maxColumns) => ({
    label: String(maxColumns),
    value: maxColumns,
  }));

  return (
    <section className="mt-4 border-b-[0.5px] border-border pb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="type-ui-2xs font-medium uppercase tracking-ui-caps text-faint">Layout</h3>
        {saving ? (
          <span aria-live="polite" className="flex items-center gap-1.5 font-mono type-ui-xs text-faint">
            <Loader2 className="size-3 animate-spin" />
            saving
          </span>
        ) : readOnly ? (
          <span className="font-mono type-ui-xs text-faint">read only</span>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="type-ui-xs text-muted">Width</span>
            <span className="font-mono type-ui-xs text-faint">{selectedPreset.maxWidthPx}px</span>
          </div>
          <SegmentedRadioGroup
            label="Layout width"
            options={widthOptions}
            value={value.width}
            disabled={disabled}
            onChange={(width) => onChange({ ...value, width })}
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="type-ui-xs text-muted">Columns</span>
            <span className="font-mono type-ui-xs text-faint">max {value.maxColumns}</span>
          </div>
          <SegmentedRadioGroup
            label="Maximum columns"
            options={columnOptions}
            value={value.maxColumns}
            disabled={disabled}
            onChange={(maxColumns) => onChange({ ...value, maxColumns })}
          />
        </div>
      </div>

      {readOnly && (
        <p className="mt-3 font-mono type-ui-xs leading-relaxed text-faint">
          Layout changes are available when the dashboard server is local.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/[0.06] px-3 py-2">
          <p className="whitespace-pre-wrap font-mono type-ui-xs leading-relaxed text-danger">{error}</p>
        </div>
      )}
    </section>
  );
}
