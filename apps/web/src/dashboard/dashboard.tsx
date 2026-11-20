import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Employee } from '@dealerflow/contracts';
import { useApi } from '../lib/api';
import { Card } from '../components/ui';
import { ContextBar } from './context-bar';
import { Kpis } from './kpis';
import { Journey } from './journey';
import { ActionCenter } from './action-center';
import { StockWidget } from './stock-widget';
import { TrendWidget } from './trend-widget';
import { ModelWidget } from './model-widget';
import { BranchWidget } from './branch-widget';
import { ActivityWidget } from './activity-widget';
import { SalesAreaWidget } from './sales-area-widget';
import { useLayout, widgetKeys } from './layout';
import { CustomizeBar, WidgetControls } from './customize';
import type { Summary } from './types';
export function Dashboard({ employee }: { employee: Employee }) {
  const [preset, setPreset] = useState(
    ['admin', 'manager'].includes(employee.role) ? 'executive' : 'operations',
  );
  return (
    <Workspace
      key={`${employee.id}-${preset}`}
      employee={employee}
      preset={preset}
      setPreset={setPreset}
    />
  );
}
const names = {
  sales: 'Top sales areas',
  stock: 'Stock at a glance',
  trends: 'Transaction pulse',
  models: 'Model spotlight',
  branches: 'Across your branches',
  activity: 'Recent activity',
};
function Workspace({
  employee,
  preset,
  setPreset,
}: {
  employee: Employee;
  preset: string;
  setPreset: (preset: string) => void;
}) {
  const [params] = useSearchParams();
  const scope = params.toString();
  const summary = useApi<Summary>(`/analytics/summary?${scope}`);
  const layout = useLayout(employee.id, employee.role, preset);
  return (
    <>
      <ContextBar
        employee={employee}
        preset={preset}
        setPreset={setPreset}
        customize={layout.begin}
        asOf={summary.data?.asOf}
      />
      <Kpis scope={scope} />
      <Journey scope={scope} />
      {layout.customizing && <CustomizeBar layout={layout} />}
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2">
          <ActionCenter scope={scope} employee={employee} />
        </div>
        {layout.widgets
          .filter((widget) => layout.customizing || widget.visible)
          .map((widget, index) => (
            <div
              key={widget.key}
              className={`min-w-0 ${widget.size === 'large' ? 'md:col-span-2 xl:col-span-3' : widget.size === 'medium' ? 'md:col-span-1 xl:col-span-2' : 'col-span-1'}`}
              onDragOver={(event) => {
                if (layout.customizing) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!layout.customizing) return;
                const key = event.dataTransfer.getData('text/plain');
                if (!widgetKeys.includes(key as (typeof widgetKeys)[number])) return;
                const from = layout.draft.findIndex((item) => item.key === key);
                const to = layout.draft.findIndex((item) => item.key === widget.key);
                layout.move(key as (typeof widgetKeys)[number], to - from);
              }}
            >
              <Card
                title={names[widget.key]}
                aside={
                  <span className="text-xs text-muted-foreground">
                    {['trends', 'sales'].includes(widget.key)
                      ? 'Selected event period'
                      : 'Current scope'}
                  </span>
                }
              >
                {layout.customizing && (
                  <WidgetControls
                    widget={widget}
                    index={index}
                    total={layout.widgets.length}
                    layout={layout}
                  />
                )}
                <div className={widget.visible ? '' : 'opacity-40'}>
                  {widget.key === 'sales' ? (
                    <SalesAreaWidget scope={scope} />
                  ) : widget.key === 'stock' ? (
                    <StockWidget scope={scope} />
                  ) : widget.key === 'trends' ? (
                    <TrendWidget scope={scope} />
                  ) : widget.key === 'models' ? (
                    <ModelWidget scope={scope} />
                  ) : widget.key === 'branches' ? (
                    <BranchWidget scope={scope} />
                  ) : (
                    <ActivityWidget scope={scope} />
                  )}
                </div>
              </Card>
            </div>
          ))}
      </div>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>DealerFlow · Fictional multi-branch dealership demonstration</span>
        <span>PostgreSQL-backed · INR · Asia/Kolkata</span>
      </footer>
    </>
  );
}
