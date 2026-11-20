import { Link, useParams } from 'react-router-dom';
import { can, type Employee } from '@dealerflow/contracts';
import { useApi } from '../lib/api';
import { State } from '../components/ui';
import { RecordForm } from './record-form';
export function ResourceForm({ resource, employee }: { resource: string; employee: Employee }) {
  const { id } = useParams();
  const endpoint = resource === 'inventory' ? 'vehicles' : resource;
  const result = useApi(`/${endpoint}/${id}`, !!id);
  if (!can(employee.role, ['models', 'inventory'].includes(resource) ? 'catalog' : 'sales'))
    return <p role="alert">Your role cannot change these records.</p>;
  return (
    <>
      <Link to={`/${resource}`} className="text-sm text-primary">
        ← Back to {resource}
      </Link>
      <h1 className="text-2xl font-semibold">
        {id ? 'Edit' : 'Add'}{' '}
        {resource === 'inventory'
          ? 'vehicle'
          : resource === 'models'
            ? 'model'
            : resource === 'customers'
              ? 'customer'
              : 'booking'}
      </h1>
      {id ? (
        <State query={result}>
          {(data) => <RecordForm key={id} resource={resource} initial={data} employee={employee} />}
        </State>
      ) : (
        <RecordForm resource={resource} initial={{}} employee={employee} />
      )}
    </>
  );
}
