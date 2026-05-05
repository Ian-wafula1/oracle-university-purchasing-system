import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPaymentHistory } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { formatDate, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PaymentHistoryRow = {
  AmountPaid:        string;
  DaysLate:          number;
  DaysToPayment:     number;
  InvoiceAmount:     string;
  InvoiceID:         number;
  InvoiceNumber:     string;
  POID:              number;
  PaymentDate:       string;
  PaymentID:         number;
  PaymentMethod:     string;
  PaymentStatus:     string;
  PaymentTimeliness: string;
  ReceiptDate:       string | null;
  ReceiptNumber:     string | null;
  ReceivedBy:        string | null;
  ReferenceNumber:   string;
  SupplierID:        number;
  SupplierName:      string;
};

const TimelinessIndicator = ({ row }: { row: PaymentHistoryRow }) => {
  const isLate  = row.PaymentTimeliness === 'Late';
  const isEarly = row.DaysLate < 0;
  const days    = Math.abs(row.DaysLate);

  if (isLate) {
    return (
      <Badge variant="destructive" className="bg-destructive/10 text-destructive border-0">
        {days}d late
      </Badge>
    );
  }
  if (isEarly) {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
        {days}d early
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
      On time
    </Badge>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const styles: Record<string, string> = {
    'Bank Transfer': 'bg-blue-500/10 text-blue-700',
    'Cheque':        'bg-purple-500/10 text-purple-700',
    'Cash':          'bg-emerald-500/10 text-emerald-700',
    'Mobile Money':  'bg-orange-500/10 text-orange-700',
  };
  return (
    <Badge variant="secondary" className={`border-0 ${styles[method] ?? 'bg-muted text-muted-foreground'}`}>
      {method}
    </Badge>
  );
};

const PaymentHistoryReport = () => {
  const currentYear = new Date().getFullYear();
  const [year,        setYear]        = useState('all');
  const [timeliness,  setTimeliness]  = useState('all');
  const [supplier,    setSupplier]    = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['report-payment-history'],
    queryFn:  () => getPaymentHistory({}),
  });

  const rows = (Array.isArray(data) ? data : []) as PaymentHistoryRow[];

  // Derived filter options
  const yearOptions = useMemo(() =>
    [...new Set(rows.map((r) => String(new Date(r.PaymentDate).getFullYear())))]
      .sort((a, b) => Number(b) - Number(a)),
  [rows]);

  const supplierOptions = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach((r) => seen.set(r.SupplierID, r.SupplierName));
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Filtered + sorted rows
  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const rowYear = String(new Date(r.PaymentDate).getFullYear());
        const yearMatch      = year       === 'all' || rowYear              === year;
        const timelinessMatch= timeliness === 'all' || r.PaymentTimeliness  === timeliness;
        const supplierMatch  = supplier   === 'all' || String(r.SupplierID) === supplier;
        return yearMatch && timelinessMatch && supplierMatch;
      })
      .sort((a, b) => new Date(b.PaymentDate).getTime() - new Date(a.PaymentDate).getTime());
  }, [rows, year, timeliness, supplier]);

  // Summary totals
  const totals = useMemo(() => ({
    totalPaid:   filteredRows.reduce((s, r) => s + parseFloat(r.AmountPaid), 0),
    onTime:      filteredRows.filter((r) => r.PaymentTimeliness === 'On Time').length,
    late:        filteredRows.filter((r) => r.PaymentTimeliness === 'Late').length,
    avgDays:     filteredRows.length
      ? Math.round(filteredRows.reduce((s, r) => s + r.DaysToPayment, 0) / filteredRows.length)
      : 0,
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Payment History" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Payment History Report"
          breadcrumbs={['Reports', 'Payment History']}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs mb-1 block">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Timeliness</Label>
            <Select value={timeliness} onValueChange={setTimeliness}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="On Time">On Time</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Supplier</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {supplierOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ExportCSV data={filteredRows} filename={`payment-history-${year}`} />
        </div>

        {/* Summary pills */}
        {!isLoading && filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {filteredRows.length} payments
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {formatCurrency(totals.totalPaid)} paid
            </Badge>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
              {totals.onTime} on time
            </Badge>
            {totals.late > 0 && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                {totals.late} late
              </Badge>
            )}
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              avg {totals.avgDays}d to payment
            </Badge>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Invoice Amt</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount Paid</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment Date</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Timeliness</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No payments found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isLate       = r.PaymentTimeliness === 'Late';
                  const isPartial    = parseFloat(r.AmountPaid) < parseFloat(r.InvoiceAmount);
                  const rowBg        = isLate ? 'bg-destructive/5' : '';

                  return (
                    <tr
                      key={r.PaymentID}
                      className={`border-b transition-colors hover:bg-muted/40 ${rowBg}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.ReferenceNumber}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.SupplierName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.InvoiceNumber}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(parseFloat(r.InvoiceAmount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={isPartial ? 'text-amber-600 font-medium' : 'font-medium'}>
                          {formatCurrency(parseFloat(r.AmountPaid))}
                        </span>
                        {isPartial && (
                          <span className="block text-xs text-muted-foreground">partial</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={r.PaymentMethod} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.PaymentDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TimelinessIndicator row={r} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.ReceiptNumber ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {r.ReceivedBy ?? (
                          <span className="italic">not recorded</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!isLoading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3" colSpan={4}>Totals</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(totals.totalPaid)}
                  </td>
                  <td colSpan={5} className="px-4 py-3 text-muted-foreground text-xs font-normal">
                    {totals.onTime} on time · {totals.late} late · avg {totals.avgDays}d to payment
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default PaymentHistoryReport;
