import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Employee } from '@dealerflow/contracts';
import { api, queryClient } from './lib/api';
import { Login } from './components/login';
import { Shell } from './components/shell';
import { PaymentRecords } from './dashboard/payment-records';
import { Dashboard } from './dashboard/dashboard';
import { ResourceList } from './operations/resource-list';
import { ResourceDetail } from './operations/resource-detail';
import { ResourceForm } from './operations/resource-form';
import { OrderDetail } from './operations/order-detail';
import { QuotationPrototype } from './quotations/quotation-prototype';
import './theme.css';
function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(!!sessionStorage.getItem('dealerflow.token'));
  useEffect(() => {
    const logout = () => setEmployee(null);
    window.addEventListener('dealerflow:logout', logout);
    if (sessionStorage.getItem('dealerflow.token'))
      api<Employee>('/auth/me')
        .then(setEmployee)
        .catch(() => {
          sessionStorage.removeItem('dealerflow.token');
        })
        .finally(() => setLoading(false));
    return () => window.removeEventListener('dealerflow:logout', logout);
  }, []);
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      sessionStorage.removeItem('dealerflow.token');
      queryClient.clear();
      setEmployee(null);
    }
  }
  if (loading)
    return (
      <p role="status" className="p-8">
        Restoring your session…
      </p>
    );
  if (!employee) return <Login onLogin={setEmployee} />;
  return (
    <Shell employee={employee} logout={() => void logout()}>
      <Routes>
        <Route path="/" element={<Dashboard employee={employee} />} />
        <Route path="/records" element={<PaymentRecords />} />
        <Route path="/quotations" element={<QuotationPrototype />} />
        <Route path="/overview" element={<Navigate to="/" replace />} />
        {['models', 'inventory', 'customers', 'bookings', 'orders'].map((resource) => (
          <React.Fragment key={resource}>
            <Route
              path={`/${resource}`}
              element={<ResourceList key={resource} resource={resource} employee={employee} />}
            />
            {resource !== 'orders' && (
              <>
                <Route
                  path={`/${resource}/new`}
                  element={
                    <ResourceForm key={`new-${resource}`} resource={resource} employee={employee} />
                  }
                />
                <Route
                  path={`/${resource}/:id/edit`}
                  element={
                    <ResourceForm
                      key={`edit-${resource}`}
                      resource={resource}
                      employee={employee}
                    />
                  }
                />
              </>
            )}
            <Route
              path={`/${resource}/:id/*`}
              element={
                resource === 'orders' ? (
                  <OrderDetail employee={employee} />
                ) : (
                  <ResourceDetail resource={resource} employee={employee} />
                )
              }
            />
          </React.Fragment>
        ))}
        <Route
          path="*"
          element={
            <section>
              <h1 className="text-2xl font-semibold">Page not found</h1>
              <a href="/" className="text-primary">
                Return to Command Center
              </a>
            </section>
          }
        />
      </Routes>
    </Shell>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
