import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getContracts, createContract } from '@/api/contracts';
import { getSuppliers } from '@/api/suppliers';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SlideOver } from '@/components/SlideOver';
import { formatDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const ContractsPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: contracts = [], isLoading } = useQuery({ queryKey: ['contracts'], queryFn: () => getContracts() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-approved'], queryFn: () => getSuppliers({ status: 'Approved' }) });

  const createMut = useMutation({
    mutationFn: createContract,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); setShowCreate(false); toast.success('Contract created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm();
  const [supplierId, setSupplierId] = useState('');

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'contractnumber', header: 'Contract #' },
    { key: 'suppliername', header: 'Supplier' },
    { key: 'contractstatus', header: 'Status', render: (r) => <StatusBadge status={String(r.contractstatus || '')} /> },
    { key: 'totalitems', header: 'Items' },
  ];

  return (
    <>
      <TopBar title="Contracts" />
      <div className="page-container">
        <PageHeader title="Contracts" breadcrumbs={['Procurement', 'Contracts']} action={{ label: 'New Contract', onClick: () => setShowCreate(true), icon: <Plus className="h-4 w-4" /> }} />
        <DataTable columns={columns} data={contracts as Record<string, unknown>[]} isLoading={isLoading} onRowClick={(r) => navigate(`/contracts/${r.ContractID}`)} />

        <SlideOver open={showCreate} onOpenChange={setShowCreate} title="New Contract">
          <form onSubmit={handleSubmit((d) => createMut.mutate({ ...d, SupplierID: Number(supplierId) }))} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {(suppliers as Record<string, unknown>[]).map((s) => (
                    <SelectItem key={String(s.SupplierID)} value={String(s.SupplierID)}>{String(s.SupplierName)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Contract Number</Label><Input {...register('ContractNumber', { required: 'Required' })} />{errors.ContractNumber && <p className="text-xs text-destructive">{String(errors.ContractNumber.message)}</p>}</div>
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" {...register('StartDate', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>End Date</Label><Input type="date" {...register('EndDate', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Signed Date</Label><Input type="date" {...register('SignedDate')} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea {...register('Notes')} /></div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? 'Creating...' : 'Create Contract'}</Button>
          </form>
        </SlideOver>
      </div>
    </>
  );
};

export default ContractsPage;
