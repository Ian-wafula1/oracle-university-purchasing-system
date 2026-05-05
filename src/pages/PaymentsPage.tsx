import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPayments, createPayment, getPaymentMethods } from '@/api/payments';
import { getUnpaidInvoices } from '@/api/invoices';
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
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const PaymentsPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [method, setMethod] = useState('');

  const { data: payments = [], isLoading } = useQuery({ queryKey: ['payments'], queryFn: () => getPayments() });
  const { data: unpaid = [] } = useQuery({ queryKey: ['invoices-unpaid'], queryFn: () => getUnpaidInvoices() });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: () => getPaymentMethods() });

  const createMut = useMutation({
    mutationFn: createPayment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setShowCreate(false); toast.success('Payment recorded'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm();

  const selectedInvoice = (unpaid as Record<string, unknown>[]).find(i => String(i.InvoiceID) === invoiceId);

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'ReferenceNumber', header: 'Reference' },
    { key: 'SupplierName', header: 'Supplier' },
    { key: 'InvoiceNumber', header: 'Invoice' },
    { key: 'AmountPaid', header: 'Amount', render: (r) => formatCurrency(r.AmountPaid as number) },
    { key: 'PaymentMethod', header: 'Method' },
    { key: 'ReceiptNumber', header: 'Receipt' },
  ];

  return (
    <>
      <TopBar title="Payments" />
      <div className="page-container">
        <PageHeader title="Payments" breadcrumbs={['Finance', 'Payments']} action={{ label: 'New Payment', onClick: () => setShowCreate(true), icon: <Plus className="h-4 w-4" /> }} />
        <DataTable columns={columns} data={payments as Record<string, unknown>[]} isLoading={isLoading} onRowClick={(r) => navigate(`/payments/${r.PaymentID}`)} />

        <SlideOver open={showCreate} onOpenChange={setShowCreate} title="Record Payment">
          <form onSubmit={handleSubmit((d) => createMut.mutate({ ...d, InvoiceID: Number(invoiceId), PaymentMethod: method }))} className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {(unpaid as Record<string, unknown>[]).map(inv => (
                    <SelectItem key={String(inv.InvoiceID)} value={String(inv.InvoiceID)}>
                      {String(inv.SupplierName)} — {String(inv.InvoiceNumber)} ({formatCurrency(inv.BalanceOutstanding as number)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInvoice && <p className="text-xs text-muted-foreground">Outstanding: <span className="font-semibold text-foreground">{formatCurrency(selectedInvoice.BalanceOutstanding as number)}</span></p>}
            </div>
            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" {...register('AmountPaid', { required: 'Required' })} />{errors.AmountPaid && <p className="text-xs text-destructive">{String(errors.AmountPaid.message)}</p>}</div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>{(methods as string[]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reference Number</Label><Input {...register('ReferenceNumber', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Received By</Label><Input {...register('ReceivedBy')} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea {...register('Notes')} /></div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? 'Processing...' : 'Record Payment'}</Button>
          </form>
        </SlideOver>
      </div>
    </>
  );
};

export default PaymentsPage;
