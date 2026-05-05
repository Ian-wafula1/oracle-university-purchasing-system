import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPurchaseOrder, updatePurchaseOrder, getPurchaseOrderItems, deleteOrderDetail } from '@/api/purchaseOrders';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import { useState } from 'react';

const PODetailPage = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: po, isLoading } = useQuery({ queryKey: ['po', id], queryFn: () => getPurchaseOrder(Number(id)) });
  const { data: poItems = [] } = useQuery({ queryKey: ['po-items', id], queryFn: () => getPurchaseOrderItems(Number(id)) });

  const approveMut = useMutation({
    mutationFn: () => updatePurchaseOrder(Number(id), { action: 'approve' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['po', id] }); toast.success('PO approved'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteOrderDetail,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['po-items', id] }); setDeleteTarget(null); toast.success('Item removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const itemCols: Column<Record<string, unknown>>[] = [
    { key: 'ItemName', header: 'Item' },
    { key: 'Quantity', header: 'Qty' },
    { key: 'UnitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.UnitPrice as number) },
    { key: 'Discount', header: 'Discount', render: (r) => `${r.Discount}%` },
    { key: 'TotalPrice', header: 'Total', render: (r) => formatCurrency(r.TotalPrice as number) },
    { key: '_del', header: '', render: (r) => po?.Status === 'Pending' ? (
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(r.OrderDetailID as number)}><Trash2 className="h-3.5 w-3.5" /></Button>
    ) : null },
  ];

  if (isLoading) return <><TopBar title="Purchase Order" /><div className="page-container"><Skeleton className="h-48 w-full" /></div></>;

  const orderTotal = (poItems as Record<string, unknown>[]).reduce((sum, i) => sum + Number(i.TotalPrice || 0), 0);

  return (
    <>
      <TopBar title={`PO #${po?.POID || ''}`} />
      <div className="page-container space-y-6">
        <PageHeader title={`Purchase Order #${po?.POID || ''}`} breadcrumbs={['Procurement', 'Purchase Orders', `PO #${po?.POID || ''}`]} />

        <Card>
          <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-medium text-sm">{po?.SupplierName}</p></div>
            <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm">{formatDate(po?.PODate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Expected</p><p className="text-sm">{formatDate(po?.ExpectedDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={po?.Status || ''} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Order Items</CardTitle>
            {hasRole('approver', 'admin') && po?.Status === 'Pending' && (
              <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="gap-1">
                <CheckCircle className="h-4 w-4" />Approve
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <DataTable columns={itemCols} data={poItems as Record<string, unknown>[]} emptyMessage="No items" />
            <div className="mt-4 text-right">
              <span className="text-sm text-muted-foreground mr-2">Order Total:</span>
              <span className="font-bold">{formatCurrency(orderTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <ConfirmModal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Remove Item" description="Remove this item?" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)} confirmLabel="Remove" destructive />
      </div>
    </>
  );
};

export default PODetailPage;
