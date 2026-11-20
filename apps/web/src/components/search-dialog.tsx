import { useState, useEffect, useRef, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Row } from '@dealerflow/contracts';
import { useApi } from '../lib/api';
import { Dialog, State, control } from './ui';
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [params] = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const query = new URLSearchParams();
  for (const key of ['branch_id', 'model_id'])
    if (params.get(key)) query.set(key, params.get(key)!);
  query.set('q', term);
  const result = useApi<{ items: Row[] }>(`/analytics/search?${query}`, term.length >= 2);
  return (
    <Dialog title="Search workspace" aria-labelledby={titleId} onClose={onClose}>
      <label className="grid gap-2 text-sm">
        VIN, model, customer, booking or invoice
        <input
          autoFocus
          className={control}
          value={text}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setTerm(value), 300);
          }}
        />
      </label>
      {term.length >= 2 && (
        <State query={result}>
          {(data) => (
            <ul className="mt-4 divide-y divide-border">
              {data.items.map((item) => (
                <li key={String(item.id)}>
                  <Link
                    to={String(item.route)}
                    onClick={onClose}
                    className="block rounded-control p-3 hover:bg-muted"
                  >
                    <span className="block text-xs text-muted-foreground">{String(item.type)}</span>
                    <span className="text-sm">{String(item.label)}</span>
                  </Link>
                </li>
              ))}
              {data.items.length === 0 && <li className="p-4 text-sm">No matching records.</li>}
            </ul>
          )}
        </State>
      )}
    </Dialog>
  );
}
