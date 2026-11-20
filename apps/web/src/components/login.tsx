import { useState, type FormEvent } from 'react';
import { CarFront, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Button, control } from './ui';
import type { Employee } from '@dealerflow/contracts';
export function Login({ onLogin }: { onLogin: (employee: Employee) => void }) {
  const [state, setState] = useState({ error: '', pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ error: '', pending: true });
    try {
      const result = await api<{ token: string; employee: Employee }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form)),
      });
      sessionStorage.setItem('dealerflow.token', result.token);
      onLogin(result.employee);
    } catch (error) {
      setState({ error: (error as Error).message, pending: false });
    }
  }
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-primary p-8 text-primary-foreground lg:p-16">
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <CarFront size={32} />
          DealerFlow
        </div>
        <div className="space-y-6 py-16">
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight">
            Every vehicle.
            <br />
            Every milestone.
            <br />
            One clear view.
          </h1>
          <p className="max-w-md text-base leading-relaxed opacity-80">
            From the first reservation to the final handover. A connected workspace for your
            dealership.
          </p>
          <div className="rounded-container bg-card/10 p-6">
            <VehicleScene />
          </div>
        </div>
        <p className="text-xs opacity-80">
          Fictional dealership demonstration · Not a production DMS
        </p>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <div className="mb-4 inline-flex rounded-container bg-secondary p-3 text-primary">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your dealership workspace.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-6">
            <label className="grid gap-2 text-sm font-medium">
              Work email
              <input
                className={control}
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@dealerflow.demo"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Password
              <input
                className={control}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={state.pending} className="w-full">
              {state.pending ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Employee accounts are provisioned by the explicit seed command. Use the generated
            password from your private environment.
          </p>
        </div>
      </section>
    </main>
  );
}
function VehicleScene() {
  return (
    <>
      <img
        src="/vehicles/suv.svg"
        alt="Representative SUV illustration"
        width="600"
        height="280"
        className="w-full"
      />
      <div className="flex justify-between text-xs">
        <span>AVAILABLE → RESERVED</span>
        <span>READY → DELIVERED</span>
      </div>
    </>
  );
}
