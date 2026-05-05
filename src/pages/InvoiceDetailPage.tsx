import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoice, updateInvoice } from '@/api/invoices';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { SlideOver } from '@/components/SlideOver';
import { Label } from '@/components/ui/label';

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => getInvoice(Number(id)) });

  const disputeMut = useMutation({
    mutationFn: () => updateInvoice(Number(id), { action: 'dispute', reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowDispute(false); toast.success('Invoice disputed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inv = data?.invoice || data || {};
  const lineItems = data?.line_items || [];
  const payments = data?.payments || [];

  const lineCols: Column<Record<string, unknown>>[] = [
    { key: 'ItemName', header: 'Item' },
    { key: 'Quantity', header: 'Qty' },
    { key: 'UnitPrice', header: 'Price', render: (r) => formatCurrency(r.UnitPrice as number) },
    { key: 'TotalPrice', header: 'Total', render: (r) => formatCurrency(r.TotalPrice as number) },
  ];

  const paymentCols: Column<Record<string, unknown>>[] = [
    { key: 'ReferenceNumber', header: 'Reference' },
    { key: 'AmountPaid', header: 'Amount', render: (r) => formatCurrency(r.AmountPaid as number) },
    { key: 'PaymentMethod', header: 'Method' },
    { key: 'PaymentDate', header: 'Date', render: (r) => formatDate(r.PaymentDate as string) },
  ];

  if (isLoading) return <><TopBar title="Invoice" /><div className="page-container"><Skeleton className="h-48 w-full" /></div></>;

  return (
    <>
      <TopBar title={`Invoice ${inv.InvoiceNumber || ''}`} />
      <div className="page-container space-y-6">
        <PageHeader title={`Invoice ${inv.InvoiceNumber || ''}`} breadcrumbs={['Finance', 'Invoices', inv.InvoiceNumber || '']} />

        <Card>
          <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-medium text-sm">{inv.SupplierName}</p></div>
            <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-medium text-sm">{formatCurrency(inv.InvoiceAmount)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-semibold text-sm text-destructive">{formatCurrency(inv.BalanceOutstanding)}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={inv.Status || ''} /><Button size="sm" variant="outline" className="ml-2 text-xs" onClick={() => setShowDispute(true)}>Dispute</Button></div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">PO Line Items</CardTitle></CardHeader><CardContent><DataTable columns={lineCols} data={lineItems} emptyMessage="No items" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader><CardContent><DataTable columns={paymentCols} data={payments} emptyMessage="No payments" /></CardContent></Card>

        <SlideOver open={showDispute} onOpenChange={setShowDispute} title="Dispute Invoice">
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <Button className="w-full" onClick={() => disputeMut.mutate()} disabled={disputeMut.isPending}>{disputeMut.isPending ? 'Submitting...' : 'Submit Dispute'}</Button>
          </div>
        </SlideOver>
      </div>
    </>
  );
};

export default InvoiceDetailPage;
