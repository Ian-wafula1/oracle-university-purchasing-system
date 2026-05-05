import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPurchaseOrders, createPurchaseOrder } from '@/api/purchaseOrders';
import { getSuppliers } from '@/api/suppliers';
import { getItems } from '@/api/items';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SlideOver } from '@/components/SlideOver';
import { formatDate, formatCurrency } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface LineItem { ItemID: string; Quantity: string; UnitPrice: string; Discount: string; }

const PurchaseOrdersPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ItemID: '', Quantity: '1', UnitPrice: '', Discount: '0' }]);

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => getPurchaseOrders() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-approved'], queryFn: () => getSuppliers({ status: 'Approved' }) });
  const { data: allItems } = useQuery({ queryKey: ['items'], queryFn: () => getItems() });
  const items = (allItems?.items || allItems || []) as Record<string, unknown>[];

  const createMut = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setShowCreate(false); toast.success('Purchase order created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm();

  const addLine = () => setLineItems([...lineItems, { ItemID: '', Quantity: '1', UnitPrice: '', Discount: '0' }]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'POID', header: 'PO#' },
    { key: 'SupplierName', header: 'Supplier' },
    { key: 'Status', header: 'Status', render: (r) => <StatusBadge status={String(r.Status || '')} /> },
    { key: 'TotalLineItems', header: 'Items' },
    { key: 'OrderTotal', header: 'Total', render: (r) => formatCurrency(r.OrderTotal as number) },
  ];

  return (
    <>
      <TopBar title="Purchase Orders" />
      <div className="page-container">
        <PageHeader title="Purchase Orders" breadcrumbs={['Procurement', 'Purchase Orders']} action={{ label: 'New PO', onClick: () => setShowCreate(true), icon: <Plus className="h-4 w-4" /> }} />
        <DataTable
          columns={columns}
          data={orders as Record<string, unknown>[]}
          isLoading={isLoading}
          onRowClick={(r) => navigate(`/purchase-orders/${r.POID}`)}
          rowClassName={(r) => String(r.DueStatus) === 'Overdue' ? 'bg-warning/5' : ''}
        />

        <SlideOver open={showCreate} onOpenChange={setShowCreate} title="New Purchase Order">
          <form onSubmit={handleSubmit((d) => createMut.mutate({
            ...d, SupplierID: Number(supplierId),
            items: lineItems.map(l => ({ ItemID: Number(l.ItemID), Quantity: Number(l.Quantity), UnitPrice: Number(l.UnitPrice), Discount: Number(l.Discount) })),
          }))} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{(suppliers as Record<string, unknown>[]).map(s => <SelectItem key={String(s.SupplierID)} value={String(s.SupplierID)}>{String(s.SupplierName)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Expected Delivery</Label><Input type="date" {...register('ExpectedDate', { required: 'Required' })} />{errors.ExpectedDate && <p className="text-xs text-destructive">{String(errors.ExpectedDate.message)}</p>}</div>
            <div className="space-y-2"><Label>Notes</Label><Textarea {...register('Notes')} /></div>

            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>Line Items</Label><Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
              {lineItems.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_80px_60px_32px] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Item</Label>
                    <Select value={line.ItemID} onValueChange={(v) => updateLine(i, 'ItemID', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{items.map(it => <SelectItem key={String(it.ItemID)} value={String(it.ItemID)}>{String(it.ItemName)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Qty</Label><Input className="h-8 text-xs" type="number" value={line.Quantity} onChange={e => updateLine(i, 'Quantity', e.target.value)} /></div>
                  <div><Label className="text-xs">Price</Label><Input className="h-8 text-xs" type="number" step="0.01" value={line.UnitPrice} onChange={e => updateLine(i, 'UnitPrice', e.target.value)} /></div>
                  <div><Label className="text-xs">Disc%</Label><Input className="h-8 text-xs" type="number" value={line.Discount} onChange={e => updateLine(i, 'Discount', e.target.value)} /></div>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => removeLine(i)} disabled={lineItems.length === 1}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? 'Creating...' : 'Create PO'}</Button>
          </form>
        </SlideOver>
      </div>
    </>
  );
};

export default PurchaseOrdersPage;
