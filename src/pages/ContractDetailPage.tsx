import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContract, updateContract, getContractItems, addContractItem, deleteContractItem } from '@/api/contracts';
import { getItems } from '@/api/items';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem as SI, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';

const ContractDetailPage = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [newItemId, setNewItemId] = useState('');

  const { data: contract, isLoading } = useQuery({ queryKey: ['contract', id], queryFn: () => getContract(Number(id)) });
  const { data: contractItems = [] } = useQuery({ queryKey: ['contract-items', id], queryFn: () => getContractItems(Number(id)) });
  const { data: allItems } = useQuery({ queryKey: ['items'], queryFn: () => getItems() });
  const items = (allItems?.items || allItems || []) as Record<string, unknown>[];

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateContract(Number(id), body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contract', id] }); toast.success('Contract updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItemMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => addContractItem(Number(id), body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contract-items', id] }); toast.success('Item added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: deleteContractItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contract-items', id] }); setDeleteTarget(null); toast.success('Item removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit } = useForm();
  const { register: regItem, handleSubmit: submitItem, reset: resetItem } = useForm();

  const itemCols: Column<Record<string, unknown>>[] = [
    { key: 'ItemName', header: 'Item' },
    { key: 'AgreedPrice', header: 'Agreed Price', render: (r) => formatCurrency(r.AgreedPrice as number) },
    { key: '_del', header: '', render: (r) => (
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(r.ContractItemID as number)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    )},
  ];

  if (isLoading) return <><TopBar title="Contract" /><div className="page-container"><Skeleton className="h-48 w-full" /></div></>;

  const c = contract || {};

  return (
    <>
      <TopBar title={`Contract ${c.ContractNumber || ''}`} />
      <div className="page-container space-y-6">
        <PageHeader title={`Contract ${c.ContractNumber || ''}`} breadcrumbs={['Procurement', 'Contracts', c.ContractNumber || '']} />

        <Card>
          <CardHeader><CardTitle className="text-base">Contract Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => updateMut.mutate(d))} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Supplier</Label><p className="text-sm">{c.SupplierName}</p></div>
              <div className="space-y-2"><Label>Status</Label><StatusBadge status={c.ContractStatus || ''} /></div>
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" defaultValue={c.StartDate?.split('T')[0]} {...register('StartDate')} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" defaultValue={c.EndDate?.split('T')[0]} {...register('EndDate')} /></div>
              <div className="col-span-full"><Button type="submit" disabled={updateMut.isPending}>{updateMut.isPending ? 'Saving...' : 'Save'}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Contract Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable columns={itemCols} data={contractItems as Record<string, unknown>[]} emptyMessage="No items" />
            <form onSubmit={submitItem((d) => { addItemMut.mutate({ ItemID: Number(newItemId), AgreedPrice: Number(d.AgreedPrice) }); resetItem(); })} className="flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Item</Label>
                <Select value={newItemId} onValueChange={setNewItemId}>
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>{items.map(i => <SI key={String(i.ItemID)} value={String(i.ItemID)}>{String(i.ItemName)}</SI>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-32"><Label className="text-xs">Price</Label><Input type="number" step="0.01" {...regItem('AgreedPrice', { required: true })} /></div>
              <Button type="submit" size="sm" disabled={addItemMut.isPending}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </form>
          </CardContent>
        </Card>

        <ConfirmModal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Remove Item" description="Remove this item from the contract?" onConfirm={() => deleteTarget && deleteItemMut.mutate(deleteTarget)} confirmLabel="Remove" destructive />
      </div>
    </>
  );
};

export default ContractDetailPage;
