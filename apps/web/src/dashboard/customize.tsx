import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Select } from '../components/ui';
import { type Widget, type useLayout } from './layout';
export function CustomizeBar({ layout }: { layout: ReturnType<typeof useLayout> }) {
  return (
    <section
      aria-label="Customize workspace"
      className="space-y-4 rounded-container border border-primary bg-secondary p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Make this workspace yours</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag handles or use Move up/down. Changes are a draft until saved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button secondary onClick={layout.reset}>
            Reset defaults
          </Button>
          <Button secondary onClick={layout.cancel}>
            Cancel
          </Button>
          <Button onClick={layout.save}>Save layout</Button>
        </div>
      </div>
      {layout.error && (
        <p role="alert" className="text-sm text-destructive">
          {layout.error}
        </p>
      )}
    </section>
  );
}
export function WidgetControls({
  widget,
  index,
  total,
  layout,
}: {
  widget: Widget;
  index: number;
  total: number;
  layout: ReturnType<typeof useLayout>;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-border bg-secondary p-3">
      <button
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', widget.key);
          event.dataTransfer.effectAllowed = 'move';
        }}
        className="flex min-h-11 items-center gap-1 rounded-control border border-border bg-card px-3 text-xs"
        aria-label={`Drag ${widget.key} widget`}
      >
        <GripVertical size={16} />
        {widget.key}
      </button>
      <Button
        secondary
        disabled={index === 0}
        aria-label={`Move ${widget.key} up`}
        onClick={() => layout.move(widget.key, -1)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        secondary
        disabled={index === total - 1}
        aria-label={`Move ${widget.key} down`}
        onClick={() => layout.move(widget.key, 1)}
      >
        <ArrowDown size={14} />
      </Button>
      <Select
        label="Widget size"
        value={widget.size}
        onChange={(event) =>
          layout.change(widget.key, { size: event.target.value as Widget['size'] })
        }
      >
        {['small', 'medium', 'large'].map((size) => (
          <option key={size}>{size}</option>
        ))}
      </Select>
      <label className="flex min-h-11 items-center gap-2 px-2 text-xs">
        <input
          type="checkbox"
          checked={widget.visible}
          onChange={(event) => layout.change(widget.key, { visible: event.target.checked })}
        />
        Visible
      </label>
    </div>
  );
}
