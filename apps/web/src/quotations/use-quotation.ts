import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { quotationPreviewSchema, type QuotationEstimate, type Row } from '@dealerflow/contracts';
import { api, useApi, type List } from '../lib/api';

type Draft = { model_id: string; model_year: string; quantity: string; city: string };
export function useQuotation() {
  const [values, setValues] = useState<Draft>({
    model_id: '',
    model_year: String(new Date().getFullYear()),
    quantity: '1',
    city: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const errorSummary = useRef<HTMLDivElement>(null);
  const estimateHeading = useRef<HTMLHeadingElement>(null);
  const branches = useApi<{ items: Row[] }>('/branches');
  const estimate = useMutation({
    mutationFn: (body: unknown) =>
      api<QuotationEstimate>('/quotations/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => requestAnimationFrame(() => estimateHeading.current?.focus()),
  });
  const request = () => ({
    ...values,
    model_year: Number(values.model_year),
    quantity: Number(values.quantity),
  });
  function change(field: keyof Draft, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: [] }));
    estimate.reset();
  }
  function validate(field: keyof Draft) {
    const parsed = quotationPreviewSchema.safeParse(request());
    setErrors((current) => ({
      ...current,
      [field]: parsed.success ? [] : parsed.error.flatten().fieldErrors[field] || [],
    }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = quotationPreviewSchema.safeParse(request());
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    setErrors({});
    estimate.mutate(parsed.data);
  }
  return {
    values,
    errors,
    errorSummary,
    estimateHeading,
    branches,
    estimate,
    change,
    validate,
    submit,
  };
}
export function useQuotationModels(term: string, page: number, selected: string) {
  return {
    models: useApi<List>(`/models?limit=20&page=${page}&q=${encodeURIComponent(term)}`),
    selected: useApi(`/models/${selected}`, !!selected),
  };
}
export type QuotationState = ReturnType<typeof useQuotation>;
