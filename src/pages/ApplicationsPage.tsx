import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApplications, updateApplication } from '@/api/applications';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SlideOver } from '@/components/SlideOver';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const ApplicationsPage = () => {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('All');
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', statusFilter],
    queryFn: () => getApplications(statusFilter !== 'All' ? { status: statusFilter } : {}),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => updateApplication(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); setEditTarget(null); toast.success('Application updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'SupplierName', header: 'Supplier' },
    { key: 'ApprovalStatus', header: 'Status', render: (r) => <StatusBadge status={String(r.ApprovalStatus || 'Pending')} /> },
    { key: 'ReviewNotes', header: 'Notes' },
  ];

  return (
    <>
      <TopBar title="Applications" />
      <div className="page-container">
        <PageHeader title="Supplier Applications" breadcrumbs={['Procurement', 'Applications']} />
        <div className="mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All', 'Pending', 'Approved', 'Rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={applications as Record<string, unknown>[]}
          isLoading={isLoading}
          onRowClick={hasRole('approver', 'admin') ? (r) => setEditTarget(r) : undefined}
        />
        <SlideOver open={!!editTarget} onOpenChange={() => setEditTarget(null)} title="Review Application">
          {editTarget && <ReviewForm target={editTarget} onSubmit={(body) => updateMut.mutate({ id: editTarget.ApplicationID as number, body })} isPending={updateMut.isPending} />}
        </SlideOver>
      </div>
    </>
  );
};

const ReviewForm = ({ target, onSubmit, isPending }: { target: Record<string, unknown>; onSubmit: (b: Record<string, unknown>) => void; isPending: boolean }) => {
  const [status, setStatus] = useState(String(target.ApprovalStatus || 'Pending'));
  const { register, handleSubmit } = useForm();
  return (
    <form onSubmit={handleSubmit((d) => onSubmit({ ...d, ApprovalStatus: status }))} className="space-y-4">
      <div className="space-y-2"><Label>Supplier</Label><p className="text-sm">{String(target.SupplierName)}</p></div>
      <div className="space-y-2">
        <Label>Decision</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Notes</Label><Textarea defaultValue={String(target.ReviewNotes || '')} {...register('ReviewNotes')} /></div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Saving...' : 'Update'}</Button>
    </form>
  );
};

export default ApplicationsPage;
