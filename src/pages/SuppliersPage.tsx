import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getSuppliers, createSupplier, deleteSupplier, approveSupplier } from '@/api/suppliers';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SlideOver } from '@/components/SlideOver';
import { ConfirmModal } from '@/components/ConfirmModal';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const SuppliersPage = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', statusFilter],
    queryFn: () => getSuppliers(statusFilter !== 'All' ? { status: statusFilter } : {}),
  });

  const createMut = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowCreate(false); toast.success('Supplier created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDeleteTarget(null); toast.success('Supplier deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => approveSupplier(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setApproveTarget(null); toast.success('Supplier updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const filtered = (suppliers as Record<string, unknown>[]).filter((s) =>
    String(s.SupplierName || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'SupplierName', header: 'Name' },
    { key: 'Email', header: 'Email' },
    { key: 'Phone', header: 'Phone' },
    { key: 'Status', header: 'Status', render: (r) => <StatusBadge status={String(r.Status || 'Pending')} /> },
    
    ...(hasRole('approver', 'admin') ? [{
      key: '_actions' as const,
      header: 'Actions',
      render: (r: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setApproveTarget(r); }}>
            Review
          </Button>
          {hasRole('admin') && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.SupplierID as number); }}>
              Delete
            </Button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <TopBar title="Suppliers" />
      <div className="page-container">
        <PageHeader
          title="Suppliers"
          breadcrumbs={['Procurement', 'Suppliers']}
          action={{ label: 'New Supplier', onClick: () => { reset(); setShowCreate(true); }, icon: <Plus className="h-4 w-4" /> }}
        />

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All', 'Applied', 'Approved', 'Suspended'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={(r) => navigate(`/suppliers/${r.SupplierID}`)} emptyMessage="No suppliers found" />

        <SlideOver open={showCreate} onOpenChange={setShowCreate} title="New Supplier">
          <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
            <div className="space-y-2"><Label>Supplier Name</Label><Input {...register('SupplierName', { required: 'Required' })} />{errors.SupplierName && <p className="text-xs text-destructive">{String(errors.SupplierName.message)}</p>}</div>
            <div className="space-y-2"><Label>Address</Label><Input {...register('Address')} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input {...register('Phone', { required: 'Required' })} />{errors.Phone && <p className="text-xs text-destructive">{String(errors.Phone.message)}</p>}</div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" {...register('Email', { required: 'Required' })} />{errors.Email && <p className="text-xs text-destructive">{String(errors.Email.message)}</p>}</div>
            <div className="space-y-2"><Label>Review Notes</Label><Textarea {...register('ReviewNotes')} /></div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? 'Creating...' : 'Create Supplier'}</Button>
          </form>
        </SlideOver>

        <SlideOver open={!!approveTarget} onOpenChange={() => setApproveTarget(null)} title={`Review: ${approveTarget?.SupplierName || ''}`}>
          <ApproveForm
            onSubmit={(body) => approveMut.mutate({ id: approveTarget?.SupplierID as number, body })}
            isPending={approveMut.isPending}
          />
        </SlideOver>

        <ConfirmModal
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
          title="Delete Supplier"
          description="This action cannot be undone."
          onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
          confirmLabel="Delete"
          destructive
        />
      </div>
    </>
  );
};

const ApproveForm = ({ onSubmit, isPending }: { onSubmit: (body: Record<string, unknown>) => void; isPending: boolean }) => {
  const [decision, setDecision] = useState('Approved');
  const { register, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit((d) => onSubmit({ ...d, ApprovalStatus: decision }))} className="space-y-4">
      <div className="space-y-2">
        <Label>Decision</Label>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Review Notes</Label><Textarea {...register('ReviewNotes')} /></div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Submitting...' : 'Submit Review'}</Button>
    </form>
  );
};

export default SuppliersPage;
