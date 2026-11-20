import { useState } from 'react';
import type { Row } from '@dealerflow/contracts';
import { queryClient, str } from './api';
export function useDocumentDownload(orderId: string) {
  const [error, setError] = useState('');
  const download = (record: Row) => {
    setError('');
    void downloadAttachment(orderId, str(record.id), str(record.filename)).catch((cause) =>
      setError(cause.message),
    );
  };
  return [error, setError, download] as const;
}
export async function downloadAttachment(orderId: string, documentId: string, filename: string) {
  const response = await fetch(`/api/orders/${orderId}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem('dealerflow.token')}` },
  });
  if (response.status === 401) {
    sessionStorage.removeItem('dealerflow.token');
    queryClient.clear();
    window.dispatchEvent(new Event('dealerflow:logout'));
  }
  if (!response.ok) throw new Error('Download failed. Your session may have expired.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
