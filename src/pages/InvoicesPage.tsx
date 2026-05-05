import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getInvoices, getUnpaidInvoices, createInvoice } from '@/api/invoices';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const InvoicesPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data: allInvoices = [], isLoading: loadingAll } = useQuery({ queryKey: ['invoices'], queryFn: () => getInvoices() });
  const { data: unpaidInvoices = [], isLoading: loadingUnpaid } = useQuery({ queryKey: ['invoices-unpaid'], queryFn: () => getUnpaidInvoices() });

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowCreate(false); toast.success('Invoice created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm();

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'InvoiceNumber', header: 'Invoice #' },
    { key: 'SupplierName', header: 'Supplier' },
    { key: 'InvoiceAmount', header: 'Amount', render: (r) => formatCurrency(r.InvoiceAmount as number) },
    { key: 'TotalPaid', header: 'Paid', render: (r) => formatCurrency(r.TotalPaid as number) },
    { key: 'BalanceOutstanding', header: 'Balance', render: (r) => formatCurrency(r.BalanceOutstanding as number) },
    { key: 'DaysOverdue', header: 'Overdue' },
    { key: 'Status', header: 'Status', render: (r) => <StatusBadge status={String(r.Status || '')} /> },
  ];

  const invoices = tab === 'unpaid' ? unpaidInvoices : allInvoices;
  const loading = tab === 'unpaid' ? loadingUnpaid : loadingAll;

  return (
    <>
      <TopBar title="Invoices" />
      <div className="page-container">
        <PageHeader title="Invoices" breadcrumbs={['Finance', 'Invoices']} action={{ label: 'New Invoice', onClick: () => setShowCreate(true), icon: <Plus className="h-4 w-4" /> }} />

        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unpaid">Unpaid</TabsTrigger></TabsList>
        </Tabs>

        <DataTable columns={columns} data={invoices as Record<string, unknown>[]} isLoading={loading} onRowClick={(r) => navigate(`/invoices/${r.InvoiceID}`)} />

        <SlideOver open={showCreate} onOpenChange={setShowCreate} title="New Invoice">
          <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
            <div className="space-y-2"><Label>PO ID</Label><Input type="number" {...register('POID', { required: 'Required' })} />{errors.POID && <p className="text-xs text-destructive">{String(errors.POID.message)}</p>}</div>
            <div className="space-y-2"><Label>Invoice Number</Label><Input {...register('InvoiceNumber', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" {...register('InvoiceDate', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Invoice Amount</Label><Input type="number" step="0.01" {...register('InvoiceAmount', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" {...register('DueDate', { required: 'Required' })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea {...register('Notes')} /></div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? 'Creating...' : 'Create Invoice'}</Button>
          </form>
        </SlideOver>
      </div>
    </>
  );
};

export default InvoicesPage;
