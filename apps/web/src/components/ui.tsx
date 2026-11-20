import { type ReactNode, type ButtonHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { ChevronDown, CarFront } from 'lucide-react';
export { State, Dialog } from './feedback';
export const control =
  'h-11 min-w-0 w-full rounded-control border border-border bg-card px-3 text-sm focus:border-primary disabled:opacity-50';
export function Button({
  children,
  secondary = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${secondary ? 'border border-border bg-card text-foreground hover:bg-muted' : 'bg-primary text-primary-foreground hover:opacity-90'} ${className}`}
    >
      {children}
    </button>
  );
}
export function Select({
  label,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={`grid min-w-0 gap-1 text-xs font-medium text-muted-foreground ${className}`}>
      <span>{label}</span>
      <span className="relative block min-w-0">
        <select
          {...props}
          className={`${control} appearance-none truncate pr-10 text-foreground`}
          title={typeof props.value === 'string' ? props.value : undefined}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        />
      </span>
    </label>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const text = String(children);
  const style = ['available', 'verified', 'paid', 'ready', 'delivered'].includes(text)
    ? 'bg-success-soft text-success'
    : ['pending', 'reserved', 'confirmed', 'in_transit'].includes(text)
      ? 'bg-warning-soft text-warning'
      : ['rejected', 'cancelled'].includes(text)
        ? 'bg-destructive-soft text-destructive'
        : 'bg-info-soft text-info';
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${style}`}>
      {text.replaceAll('_', ' ')}
    </span>
  );
}
export function Card({
  title,
  aside,
  children,
  className = '',
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-container border border-border bg-card shadow-card ${className}`}
    >
      {title && (
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}
export function VehicleImage({
  image = 'suv',
  className = '',
}: {
  image?: string;
  className?: string;
}) {
  return (
    <img
      src={`/vehicles/${['suv', 'sedan', 'hatchback', 'electric'].includes(image) ? image : 'suv'}.svg`}
      alt={`Representative ${image} illustration, not a VIN photograph`}
      width={600}
      height={280}
      loading="lazy"
      className={`aspect-[15/7] w-full rounded-control bg-muted object-contain ${className}`}
      onError={(event) => {
        event.currentTarget.src = '/vehicles/suv.svg';
      }}
    />
  );
}
export function Empty({ text = 'No records match your filters.' }: { text?: string }) {
  return (
    <div className="grid justify-items-center gap-3 p-8 text-center text-sm text-muted-foreground">
      <CarFront size={28} />
      <p>{text}</p>
    </div>
  );
}
