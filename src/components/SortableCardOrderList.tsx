import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../lib/cn";

export interface SortableCardOrderItem {
  id: string;
  title: string;
  type: string;
  size: "half" | "full";
  tab?: string;
}

interface SortableCardOrderListProps {
  items: SortableCardOrderItem[];
  disabled?: boolean;
  onOrderChange: (order: string[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

function positionLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}

function SortableCardRow({
  item,
  index,
  total,
  disabled,
}: {
  item: SortableCardOrderItem;
  index: number;
  total: number;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "dashboard-card-order-row flex min-h-10 items-center gap-2 rounded-xl border border-border bg-canvas/35 px-2 py-1.5",
        "transition-[background-color,border-color,box-shadow,opacity]",
        isDragging && "border-accent/50 bg-card shadow-lg",
        disabled && "opacity-65"
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        title={`Reorder ${item.title}`}
        aria-label={`Reorder ${item.title}`}
        disabled={disabled}
        className={cn(
          "dashboard-card-order-handle flex size-7 shrink-0 touch-none items-center justify-center rounded-lg text-faint transition-colors",
          "cursor-grab hover:bg-fg/[0.06] hover:text-fg active:cursor-grabbing",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring-color)]",
          "disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-faint"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="dashboard-card-order-index flex size-5 shrink-0 items-center justify-center rounded-full bg-border/60 font-mono type-ui-2xs text-muted">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate type-ui-sm font-medium text-fg">{item.title}</p>
        <p className="truncate font-mono type-ui-2xs text-faint">
          {item.type}
          {item.size === "full" ? " · full" : ""}
        </p>
      </div>
      <span className="sr-only">{positionLabel(index, total)}</span>
    </li>
  );
}

export function SortableCardOrderList({
  items,
  disabled = false,
  onOrderChange,
  onDragStateChange,
}: SortableCardOrderListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  const titleFor = (id: string): string => items.find((item) => item.id === id)?.title ?? id;
  const positionFor = (id: string): string => {
    const index = items.findIndex((item) => item.id === id);
    return index === -1 ? "" : positionLabel(index, items.length);
  };

  function finishDrag() {
    onDragStateChange?.(false);
  }

  function onDragStart() {
    onDragStateChange?.(true);
  }

  function onDragEnd(event: DragEndEvent) {
    finishDrag();
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over || active === over) return;

    const from = itemIds.indexOf(active);
    const to = itemIds.indexOf(over);
    if (from === -1 || to === -1) return;
    onOrderChange(arrayMove(itemIds, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragCancel={finishDrag}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space or Enter to pick up a card. Use the up and down arrow keys to move it. Press Space or Enter to drop it, or Escape to cancel.",
        },
        announcements: {
          onDragStart({ active }) {
            const id = String(active.id);
            return `Picked up ${titleFor(id)}, ${positionFor(id)}.`;
          },
          onDragOver({ active, over }) {
            const activeItem = titleFor(String(active.id));
            if (!over) return `${activeItem} is not over a card.`;
            return `${activeItem} is over ${positionFor(String(over.id))}.`;
          },
          onDragEnd({ active, over }) {
            const activeItem = titleFor(String(active.id));
            if (!over) return `Dropped ${activeItem}.`;
            return `Moved ${activeItem} to ${positionFor(String(over.id))}.`;
          },
          onDragCancel({ active }) {
            return `Cancelled moving ${titleFor(String(active.id))}.`;
          },
        },
      }}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ol className="dashboard-card-order-list flex flex-col gap-1.5 pr-1 sm:max-h-[min(58vh,28rem)] sm:overflow-y-auto">
          {items.map((item, index) => (
            <SortableCardRow
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              disabled={disabled}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
