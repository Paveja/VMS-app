import { useState } from 'react';
import { z } from 'zod';
export const widgetKeys = ['stock', 'trends', 'models', 'branches', 'activity'] as const;
const widget = z.object({
  key: z.enum(widgetKeys),
  size: z.enum(['small', 'medium', 'large']),
  visible: z.boolean(),
});
const layoutSchema = z.object({
  version: z.literal(1),
  widgets: z
    .array(widget)
    .length(5)
    .refine((items) => new Set(items.map((item) => item.key)).size === 5),
});
export type Widget = z.infer<typeof widget>;
export const defaults = (preset: string): Widget[] =>
  (preset === 'operations'
    ? ['models', 'stock', 'activity', 'branches', 'trends']
    : widgetKeys
  ).map((key) => ({
    key: key as Widget['key'],
    size: key === 'models' || key === 'branches' ? 'large' : key === 'stock' ? 'small' : 'medium',
    visible: true,
  }));
export function loadLayout(key: string, preset: string): Widget[] {
  try {
    const value = localStorage.getItem(key);
    return value ? layoutSchema.parse(JSON.parse(value)).widgets : defaults(preset);
  } catch {
    return defaults(preset);
  }
}
export function useLayout(employeeId: string, role: string, preset: string) {
  const key = `dealerflow.layout.v1.${employeeId}.${role}.${preset}`;
  const [saved, setSaved] = useState(() => loadLayout(key, preset));
  const [draft, setDraft] = useState(saved);
  const [customizing, setCustomizing] = useState(false);
  const [error, setError] = useState('');
  function save(widgets: Widget[]) {
    try {
      const validated = layoutSchema.parse({ version: 1, widgets });
      localStorage.setItem(key, JSON.stringify(validated));
      setSaved(validated.widgets);
      setDraft(validated.widgets);
      setCustomizing(false);
      setError('');
    } catch {
      setError('Layout could not be saved. Check browser storage access.');
    }
  }
  function move(key: Widget['key'], direction: number) {
    setDraft((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.key === key);
      const to = Math.max(0, Math.min(next.length - 1, from + direction));
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }
  return {
    widgets: customizing ? draft : saved,
    draft,
    customizing,
    error,
    move,
    change: (key: Widget['key'], change: Partial<Widget>) =>
      setDraft((current) =>
        current.map((item) => (item.key === key ? { ...item, ...change } : item)),
      ),
    begin: () => {
      setDraft(saved);
      setCustomizing(true);
    },
    cancel: () => {
      setDraft(saved);
      setCustomizing(false);
    },
    save: () => save(draft),
    reset: () => save(defaults(preset)),
  };
}
