import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  calculateColumnCount,
  DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX,
  DEFAULT_DASHBOARD_LAYOUT,
} from "../shared/layout";

export interface MasonryItem {
  key: string;
  /** Full items span the whole row; half items pack into columns. */
  full: boolean;
  node: ReactNode;
}

function parsePixelValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith("px")) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLayoutGapPx(el: HTMLElement): number {
  const styles = window.getComputedStyle(el);
  return parsePixelValue(styles.rowGap) ?? parsePixelValue(styles.columnGap) ?? 12;
}

function useMasonryLayout(containerRef: RefObject<HTMLDivElement | null>, maxColumns: number): { cols: number; gapPx: number } {
  const [layout, setLayout] = useState({ cols: 1, gapPx: 12 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const gapPx = readLayoutGapPx(el);
      const cols = calculateColumnCount(
        el.clientWidth,
        gapPx,
        DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX,
        maxColumns,
      );
      setLayout((current) => current.cols === cols && current.gapPx === gapPx ? current : { cols, gapPx });
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    // Theme swaps can change --layout-gap without changing the container width.
    const themeObserver = new MutationObserver(update);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [containerRef, maxColumns]);

  return layout;
}

/** Reports the wrapped card's height so the masonry can re-place it when its
 * content grows or shrinks (cards change height on every data refresh). */
function Measured({ id, onHeight, children }: { id: string; onHeight: (id: string, h: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onHeight(id, el.offsetHeight));
    observer.observe(el);
    onHeight(id, el.offsetHeight);
    return () => observer.disconnect();
  }, [id, onHeight]);
  return <div ref={ref}>{children}</div>;
}

/** Height-balanced masonry. CSS multi-column (the previous approach) fills
 * column 1 to the bottom before starting column 2, which regularly strands a
 * short card under a tall column while another column sits half empty. Here
 * each card goes to the currently-shortest column instead, in config order,
 * using live ResizeObserver-measured heights. */
export function Masonry({ items, maxColumns = DEFAULT_DASHBOARD_LAYOUT.maxColumns }: { items: MasonryItem[]; maxColumns?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { cols, gapPx } = useMasonryLayout(containerRef, maxColumns);
  const heights = useRef(new Map<string, number>());
  const [, setVersion] = useState(0);

  const onHeight = useCallback((id: string, h: number) => {
    const prev = heights.current.get(id);
    // Ignore sub-2px jitter so measurement doesn't loop with re-placement.
    if (prev !== undefined && Math.abs(prev - h) < 2) return;
    heights.current.set(id, h);
    setVersion((v) => v + 1);
  }, []);

  // Full-width items split the flow: each run of half items between them is
  // packed independently.
  const blocks: ReactNode[] = [];
  let run: MasonryItem[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    const columns: MasonryItem[][] = Array.from({ length: cols }, () => []);
    const columnHeights = new Array<number>(cols).fill(0);
    for (const item of run) {
      let shortest = 0;
      for (let i = 1; i < cols; i++) {
        if ((columnHeights[i] ?? 0) < (columnHeights[shortest] ?? 0)) shortest = i;
      }
      columns[shortest]?.push(item);
      // Unmeasured (first-paint) cards get a rough guess; the observer
      // corrects the layout immediately after mount.
      columnHeights[shortest] = (columnHeights[shortest] ?? 0) + (heights.current.get(item.key) ?? 220) + gapPx;
    }
    blocks.push(
      <div key={`run-${blocks.length}`} data-dashboard-masonry-run className="flex w-full min-w-0 items-start gap-[var(--layout-gap)]">
        {columns.map((column, i) => (
          <div key={i} data-dashboard-masonry-column className="flex min-w-0 flex-1 flex-col gap-[var(--layout-gap)]">
            {column.map((item) => (
              <Measured key={item.key} id={item.key} onHeight={onHeight}>
                {item.node}
              </Measured>
            ))}
          </div>
        ))}
      </div>
    );
    run = [];
  };

  for (const item of items) {
    if (item.full) {
      flushRun();
      blocks.push(<div key={item.key}>{item.node}</div>);
    } else {
      run.push(item);
    }
  }
  flushRun();

  return <div ref={containerRef} data-dashboard-masonry className="flex w-full min-w-0 flex-col gap-[var(--layout-gap)]">{blocks}</div>;
}
