import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getReceipt } from '@/api/receipts';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const ReceiptDetailPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['receipt', id], queryFn: () => getReceipt(Number(id)) });

  if (isLoading) return <><TopBar title="Receipt" /><div className="page-container"><Skeleton className="h-48 w-full" /></div></>;

  const r = data || {};

  return (
    <>
      <TopBar title={`Receipt ${r.ReceiptNumber || ''}`} />
      <div className="page-container">
        <PageHeader title={`Receipt ${r.ReceiptNumber || ''}`} breadcrumbs={['Finance', 'Receipts', r.ReceiptNumber || '']} />
        <Card className="max-w-lg mx-auto print:shadow-none">
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">PAYMENT RECEIPT</h2>
              <p className="text-sm text-muted-foreground">{r.ReceiptNumber}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Date</p><p>{formatDate(r.ReceiptDate)}</p></div>
              <div><p className="text-muted-foreground text-xs">Supplier</p><p className="font-medium">{r.SupplierName}</p></div>
              <div><p className="text-muted-foreground text-xs">Invoice</p><p>{r.InvoiceNumber}</p></div>
              <div><p className="text-muted-foreground text-xs">Payment Method</p><p>{r.PaymentMethod}</p></div>
              <div><p className="text-muted-foreground text-xs">Reference</p><p>{r.ReferenceNumber}</p></div>
              <div><p className="text-muted-foreground text-xs">Received By</p><p>{r.ReceivedBy}</p></div>
            </div>
            <Separator />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(r.AmountPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ReceiptDetailPage;
