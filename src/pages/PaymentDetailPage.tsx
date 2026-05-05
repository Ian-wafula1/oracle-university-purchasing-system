import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPayment } from '@/api/payments';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PaymentDetailPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['payment', id], queryFn: () => getPayment(Number(id)) });

  if (isLoading) return <><TopBar title="Payment" /><div className="page-container"><Skeleton className="h-48 w-full" /></div></>;

  const p = data || {};
  const fields = [
    ['Reference', p.ReferenceNumber], ['Supplier', p.SupplierName], ['Invoice', p.InvoiceNumber],
    ['Amount', formatCurrency(p.AmountPaid)], ['Method', p.PaymentMethod], ['Date', formatDate(p.PaymentDate)],
    ['Timeliness', p.PaymentTimeliness], ['Received By', p.ReceivedBy], ['Receipt #', p.ReceiptNumber],
  ];

  return (
    <>
      <TopBar title={`Payment ${p.ReferenceNumber || ''}`} />
      <div className="page-container">
        <PageHeader title={`Payment ${p.ReferenceNumber || ''}`} breadcrumbs={['Finance', 'Payments', p.ReferenceNumber || '']} />
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {fields.map(([label, val]) => (
              <div key={label as string}><p className="text-xs text-muted-foreground">{label as string}</p><p className="text-sm font-medium">{String(val ?? '—')}</p></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default PaymentDetailPage;
