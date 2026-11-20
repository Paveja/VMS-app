import { useState } from 'react';
import { RefreshCw, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import type { Employee } from '@dealerflow/contracts';
import { queryClient } from '../lib/api';
import { Button, Select, Dialog } from '../components/ui';
import { ScopeFilters } from './scope-filters';
export function ContextBar({
  employee,
  preset,
  setPreset,
  customize,
  asOf,
}: {
  employee: Employee;
  preset: string;
  setPreset: (value: string) => void;
  customize: () => void;
  asOf?: string;
}) {
  const [mobile, setMobile] = useState(false);
  return (
    <>
      <header className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success" />
            Fictional dealership workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Your dealership, in focus.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A clear view of what’s moving—and what needs you.
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,12rem)_auto_auto]">
          {['manager', 'admin'].includes(employee.role) ? (
            <Select
              label="Workspace preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
            >
              <option value="executive">Executive Pulse</option>
              <option value="operations">Operations Flow</option>
            </Select>
          ) : (
            <p className="flex h-11 items-center text-sm font-medium">Operations Flow</p>
          )}
          <Button secondary onClick={customize}>
            <LayoutGrid size={15} />
            Customize
          </Button>
          <Button
            secondary
            aria-label="Refresh all widgets"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['api'] })}
          >
            <RefreshCw size={15} />
          </Button>
          <p className="col-span-full text-xs text-muted-foreground sm:text-right">
            {asOf
              ? `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(asOf))} IST`
              : 'Waiting for first successful refresh'}
          </p>
        </div>
      </header>
      <div className="hidden rounded-container border border-border bg-card p-4 md:block">
        <ScopeFilters />
      </div>
      <div className="md:hidden">
        <Button secondary className="w-full" onClick={() => setMobile(true)}>
          <SlidersHorizontal size={16} />
          Branch, model & event dates
        </Button>
      </div>
      {mobile && (
        <Dialog title="Workspace filters" drawer onClose={() => setMobile(false)}>
          <ScopeFilters />
          <Button className="mt-6 w-full" onClick={() => setMobile(false)}>
            Apply & close
          </Button>
        </Dialog>
      )}
    </>
  );
}
