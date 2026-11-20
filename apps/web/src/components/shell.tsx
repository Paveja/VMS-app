import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  CarFront,
  Layers3,
  Users,
  CalendarCheck,
  ClipboardList,
  LogOut,
  Menu,
  Search,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { Employee } from '@dealerflow/contracts';
import { SearchDialog } from './search-dialog';
import { Button, Dialog } from './ui';
const links = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard },
  { to: '/inventory', label: 'Vehicle inventory', icon: CarFront },
  { to: '/models', label: 'Model catalog', icon: Layers3 },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/orders', label: 'Sales orders', icon: ClipboardList },
];
export function Shell({
  employee,
  logout,
  children,
}: {
  employee: Employee;
  logout: () => void;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const navigation = (
    <>
      <Link to="/" className="mb-8 flex items-center gap-3 px-4 text-xl font-bold tracking-tight">
        <span className="rounded-control bg-primary p-2 text-primary-foreground">
          <CarFront size={22} />
        </span>
        DealerFlow
      </Link>
      <p className="mb-3 px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Workspace
      </p>
      <nav className="space-y-2" aria-label="Main navigation">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMenu(false)}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-control px-4 text-sm font-medium ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-16">
        <div className="rounded-container border border-border bg-background p-4">
          <ShieldCheck size={20} className="mb-3 text-primary" />
          <p className="text-xs font-medium">A connected dealership</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Real records. Clear decisions.
            <br />
            Fictional demonstration data.
          </p>
        </div>
        <div className="mt-6 flex items-center gap-3 px-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">
            {employee.name
              .split(' ')
              .map((part) => part[0])
              .join('')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{employee.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{employee.role}</p>
          </div>
          <button
            aria-label="Sign out"
            onClick={logout}
            className="min-h-11 px-2 text-muted-foreground"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className="min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <aside
        data-no-print
        className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card p-4 lg:flex"
      >
        {navigation}
      </aside>
      <div className="min-w-0 lg:ml-60">
        <header
          data-no-print
          className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-8"
        >
          <div className="flex items-center gap-3">
            <Button
              secondary
              className="lg:hidden"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:inline">Workspace</span>
            <ChevronRight className="hidden text-muted-foreground sm:block" size={14} />
            <span className="text-sm font-medium">Dealership operations</span>
          </div>
          <button
            onClick={() => setSearch(true)}
            className="flex min-h-11 items-center gap-3 rounded-control border border-border px-4 text-sm text-muted-foreground"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Search your workspace</span>
            <kbd className="hidden rounded bg-muted px-1 text-xs md:inline">Search</kbd>
          </button>
        </header>
        <main id="content" className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
          {children}
        </main>
      </div>
      {menu && (
        <Dialog title="Workspace" drawer onClose={() => setMenu(false)}>
          <div className="flex min-h-full flex-col">{navigation}</div>
        </Dialog>
      )}
      {search && <SearchDialog onClose={() => setSearch(false)} />}
    </div>
  );
}
