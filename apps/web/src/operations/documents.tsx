import { useState } from 'react';
import { type Employee, type Row, can, documentCategories } from '@dealerflow/contracts';
import { useAction, str } from '../lib/api';
import { useDocumentDownload } from '../lib/download';
import { Card, Badge, Button, Select, control, Dialog } from '../components/ui';
export function Documents({ order, employee }: { order: Row; employee: Employee }) {
  const [downloadError, setDownloadError, download] = useDocumentDownload(str(order.id));
  const [reject, setReject] = useState('');
  const action = useAction(() => setReject(''));
  const documents = (order.documents || []) as Row[];
  return (
    <Card
      title="Order documents"
      aside={<span className="text-xs text-muted-foreground">Private storage</span>}
    >
      <div className="divide-y divide-border">
        {documents.map((document) => {
          const superseded = documents.some((newer) => newer.replaces_id === document.id);
          return (
            <div key={str(document.id)} className="space-y-3 px-6 py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">
                    {str(document.category)}{' '}
                    {superseded && (
                      <span className="text-xs text-muted-foreground">(replaced)</span>
                    )}
                  </p>
                  <button
                    onClick={() => void download(document)}
                    className="min-h-11 max-w-full truncate text-xs text-primary underline"
                  >
                    {str(document.filename)}
                  </button>
                </div>
                <Badge>{str(document.status)}</Badge>
              </div>
              {Boolean(document.reason) && (
                <p className="text-xs text-muted-foreground">Review: {str(document.reason)}</p>
              )}
              {can(employee.role, 'review') &&
                order.status === 'open' &&
                document.status === 'pending' &&
                !superseded && (
                  <div className="flex gap-3">
                    <Button
                      secondary
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: `/orders/${str(order.id)}/documents/${str(document.id)}/review`,
                          body: { status: 'verified' },
                        })
                      }
                    >
                      Verify
                    </Button>
                    <Button secondary onClick={() => setReject(str(document.id))}>
                      Reject
                    </Button>
                  </div>
                )}
            </div>
          );
        })}
        {!documents.length && (
          <p className="p-6 text-sm text-muted-foreground">
            Upload Identity and Address documents to prepare delivery.
          </p>
        )}
      </div>
      {can(employee.role, 'sales') && order.status === 'open' && (
        <form
          className="space-y-4 border-t border-border p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const file = form.get('file');
            if (file instanceof File && file.size > 4194304) {
              setDownloadError('File exceeds 4 MB');
              return;
            }
            action.mutate({ path: `/orders/${str(order.id)}/documents`, body: form });
          }}
        >
          <Select name="category" label="Document category">
            {documentCategories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </Select>
          <label className="grid gap-2 text-sm">
            File (PDF, JPEG or PNG, up to 4 MB)
            <input
              className={`${control} py-2`}
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
            />
          </label>
          <Button type="submit" disabled={action.isPending}>
            {action.isPending ? 'Uploading…' : 'Upload document'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Replacing a category creates a new pending review. Not regulatory verification.
          </p>
        </form>
      )}
      {(action.error || downloadError) && (
        <p role="alert" className="p-6 text-sm text-destructive">
          {action.error?.message || downloadError}
        </p>
      )}
      {reject && (
        <Dialog title="Reject document" onClose={() => setReject('')}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              action.mutate({
                path: `/orders/${str(order.id)}/documents/${reject}/review`,
                body: { status: 'rejected', reason: String(data.get('reason')) },
              });
            }}
          >
            <label className="grid gap-2 text-sm">
              Reason
              <textarea className={`${control} h-24 py-3`} name="reason" required maxLength={500} />
            </label>
            {action.error && (
              <p role="alert" className="text-destructive">
                {action.error.message}
              </p>
            )}
            <Button type="submit" disabled={action.isPending}>
              Reject document
            </Button>
          </form>
        </Dialog>
      )}
    </Card>
  );
}
