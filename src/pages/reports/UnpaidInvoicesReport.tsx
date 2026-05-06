import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnpaidInvoicesReport } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { formatDate, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type UnpaidInvoiceRow = {
  amountpaid:         number;
  balanceoutstanding: number;
  daysoverdue:        number;
  duedate:            string;
  invoiceamount:      number;
  invoicedate:        string;
  invoiceid:          number;
  invoicenumber:      string;
  notes:              string | null;
  overduestatus:      string;
  poid:               number;
  status:             string;
  supplieremail:      string;
  supplierid:         number;
  suppliername:       string;
};

const OverdueBadge = ({ days }: { days: number }) => {
  if (days <= 0) {
    return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-0">Due soon</Badge>;
  }
  const urgency =
    days > 365 ? 'bg-destructive text-destructive-foreground'   :
    days > 90  ? 'bg-destructive/10 text-destructive'           :
                 'bg-amber-500/10 text-amber-700';
  return (
    <Badge variant="secondary" className={`border-0 font-semibold ${urgency}`}>
      {days > 365
        ? `${Math.floor(days / 365)}y ${days % 365}d overdue`
        : `${days}d overdue`}
    </Badge>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Disputed': 'bg-destructive/10 text-destructive',
    'Received': 'bg-amber-500/10 text-amber-700',
    'Overdue':  'bg-destructive/10 text-destructive',
  };
  return (
    <Badge variant="secondary" className={`border-0 ${styles[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </Badge>
  );
};

const UnpaidInvoicesReport = () => {
  const [overdueOnly,  setOverdueOnly]  = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Disputed' | 'Received'>('All');

  const { data, isLoading } = useQuery({
    queryKey: ['report-unpaid'],
    queryFn:  () => getUnpaidInvoicesReport({}),
  });

  const rows = (Array.isArray(data) ? data : []) as UnpaidInvoiceRow[];

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const overdueMatch = !overdueOnly || r.daysoverdue > 0;
      const statusMatch  = statusFilter === 'All' || r.status === statusFilter;
      return overdueMatch && statusMatch;
    });
  }, [rows, overdueOnly, statusFilter]);

  const totals = useMemo(() => ({
    outstanding: filteredRows.reduce((s, r) => s + r.balanceoutstanding, 0),
    invoiced:    filteredRows.reduce((s, r) => s + r.invoiceamount,      0),
    disputed:    filteredRows.filter((r) => r.status === 'Disputed').length,
    received:    filteredRows.filter((r) => r.status === 'Received').length,
    avgOverdue:  filteredRows.length
      ? Math.round(filteredRows.reduce((s, r) => s + r.daysoverdue, 0) / filteredRows.length)
      : 0,
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Unpaid Invoices Report" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Unpaid Invoices Report"
          breadcrumbs={['Reports', 'Unpaid Invoices']}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Switch
              id="overdue-only"
              checked={overdueOnly}
              onCheckedChange={setOverdueOnly}
            />
            <Label htmlFor="overdue-only" className="cursor-pointer">
              Overdue only
            </Label>
          </div>

          {/* Status toggle pills */}
          <div className="flex items-center gap-2">
            {(['All', 'Received', 'Disputed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === s
                    ? s === 'Disputed'
                      ? 'bg-destructive text-destructive-foreground border-destructive'
                      : s === 'Received'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <ExportCSV data={filteredRows} filename="unpaid-invoices" />
        </div>

        {/* Summary pills */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {filteredRows.length} invoice{filteredRows.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="bg-destructive/10 text-destructive">
              {formatCurrency(totals.outstanding)} outstanding
            </Badge>
            {totals.disputed > 0 && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                {totals.disputed} disputed
              </Badge>
            )}
            {totals.received > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                {totals.received} pending payment
              </Badge>
            )}
            {totals.avgOverdue > 0 && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                avg {totals.avgOverdue}d overdue
              </Badge>
            )}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Invoice Amt</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Overdue</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
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
                    {rows.length === 0
                      ? 'No unpaid invoices. All invoices are settled.'
                      : 'No invoices match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isDisputed = r.status === 'Disputed';
                  const rowBg      = isDisputed
                    ? 'bg-destructive/5'
                    : r.daysoverdue > 365
                    ? 'bg-destructive/3'
                    : 'bg-amber-500/5';

                  return (
                    <tr
                      key={r.invoiceid}
                      className={`border-b transition-colors hover:bg-muted/40 ${rowBg}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{r.invoicenumber}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium block">{r.suppliername}</span>
                        <span className="text-xs text-muted-foreground">{r.supplieremail}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.invoicedate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.duedate)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(r.invoiceamount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.amountpaid > 0 ? (
                          <span className="text-emerald-600">{formatCurrency(r.amountpaid)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-destructive">
                        {formatCurrency(r.balanceoutstanding)}
                      </td>
                      <td className="px-4 py-3">
                        <OverdueBadge days={r.daysoverdue} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate"
                          title={r.notes ?? ''}>
                        {r.notes ?? <span className="italic">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!isLoading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>
                    {filteredRows.length} invoice{filteredRows.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatCurrency(totals.invoiced)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {formatCurrency(totals.outstanding)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-xs font-normal text-muted-foreground">
                    avg {totals.avgOverdue}d overdue
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

export default UnpaidInvoicesReport;
