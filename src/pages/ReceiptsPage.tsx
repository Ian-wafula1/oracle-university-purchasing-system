import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getReceipts } from '@/api/receipts';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDate, formatCurrency } from '@/lib/format';

const ReceiptsPage = () => {
  const navigate = useNavigate();
  const { data: receipts = [], isLoading } = useQuery({ queryKey: ['receipts'], queryFn: () => getReceipts() });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'receiptnumber', header: 'Receipt #' },
    { key: 'suppliername', header: 'Supplier' },
    { key: 'invoicenumber', header: 'Invoice' },
    { key: 'amountpaid', header: 'Amount', render: (r) => formatCurrency(r.amountpaid as number) },
    { key: 'paymentmethod', header: 'Method' },
    { key: 'receivedby', header: 'Received By' },
  ];

  return (
    <>
      <TopBar title="Receipts" />
      <div className="page-container">
        <PageHeader title="Receipts" breadcrumbs={['Finance', 'Receipts']} />
        <DataTable columns={columns} data={receipts as Record<string, unknown>[]} isLoading={isLoading} onRowClick={(r) => navigate(`/receipts/${r.ReceiptID}`)} />
      </div>
    </>
  );
};

export default ReceiptsPage;
