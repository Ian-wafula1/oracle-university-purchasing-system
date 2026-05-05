import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupplier, updateSupplier } from '@/api/suppliers';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/DataTable';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';

const SupplierDetailPage = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => getSupplier(Number(id)),
  });

  const supplier = data || {};
  const applications = data?.applications || [];
  const contracts = data?.contracts || [];
  console.log(data);

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateSupplier(Number(id), body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplier', id] }); toast.success('Supplier updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit } = useForm();

  const appCols: Column<Record<string, unknown>>[] = [
    { key: 'ApplicationDate', header: 'Date', render: (r) => formatDate(r.ApplicationDate as string) },
    { key: 'ApprovalStatus', header: 'Status', render: (r) => <StatusBadge status={String(r.ApprovalStatus || '')} /> },
    { key: 'ApprovalDate', header: 'Approval Date', render: (r) => formatDate(r.ApprovalDate as string) },
    { key: 'ReviewNotes', header: 'Notes' },
  ];

  const contractCols: Column<Record<string, unknown>>[] = [
    { key: 'ContractNumber', header: 'Contract' },
    { key: 'StartDate', header: 'Start', render: (r) => formatDate(r.StartDate as string) },
    { key: 'EndDate', header: 'End', render: (r) => formatDate(r.EndDate as string) },
    { key: 'ContractStatus', header: 'Status', render: (r) => <StatusBadge status={String(r.ContractStatus || '')} /> },
  ];

  if (isLoading) return (
    <>
      <TopBar title="Supplier" />
      <div className="page-container"><Skeleton className="h-48 w-full" /></div>
    </>
  );

  return (
    <>
      <TopBar title={supplier.SupplierName || 'Supplier'} />
      <div className="page-container">
        <PageHeader title={supplier.SupplierName || ''} breadcrumbs={['Procurement', 'Suppliers', supplier.SupplierName || '']} />

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader><CardTitle className="text-base">Supplier Information</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit((d) => updateMut.mutate(d))} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Name</Label><Input defaultValue={supplier.SupplierName} {...register('SupplierName')} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input defaultValue={supplier.Email} {...register('Email')} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input defaultValue={supplier.Phone} {...register('Phone')} /></div>
                  <div className="space-y-2"><Label>Address</Label><Input defaultValue={supplier.Address} {...register('Address')} /></div>
                  <div className="space-y-2"><Label>Status</Label><StatusBadge status={supplier.Status || 'Pending'} /></div>
                  <div className="space-y-2"><Label>Created</Label><p className="text-sm">{formatDate(supplier.CreatedDate)}</p></div>
                  <div className="col-span-full"><Button type="submit" disabled={updateMut.isPending}>{updateMut.isPending ? 'Saving...' : 'Save Changes'}</Button></div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <DataTable columns={appCols} data={applications} emptyMessage="No applications" />
          </TabsContent>

          <TabsContent value="contracts">
            <DataTable columns={contractCols} data={contracts} emptyMessage="No contracts" />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SupplierDetailPage;
