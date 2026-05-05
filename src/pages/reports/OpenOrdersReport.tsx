import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOpenOrders } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { formatDate, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type OpenOrderRow = {
  ApprovedBy:          string | null;
  CreatedBy:           string;
  DueStatus:           string;
  EstimatedOrderValue: string;
  ExpectedDate:        string;
  Notes:               string | null;
  OverdueDays:         number;
  PODate:              string;
  POID:                number;
  Status:              string;
  SupplierName:        string;
  TotalLineItems:      number;
};

const DueStatusBadge = ({ status, days }: { status: string; days: number }) => {
  if (status === 'Overdue') {
    const urgency =
      days > 365 ? 'bg-destructive text-destructive-foreground'  :
      days > 90  ? 'bg-destructive/10 text-destructive'          :
                   'bg-amber-500/10 text-amber-700';
    return (
      <Badge variant="secondary" className={`border-0 font-semibold ${urgency}`}>
        {days > 365
          ? `${Math.floor(days / 365)}y ${days % 365}d overdue`
          : `${days}d overdue`}
      </Badge>
    );
  }
  if (status === 'Due Soon') {
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-0">
        Due soon
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
      On track
    </Badge>
  );
};

const POStatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Approved': 'bg-blue-500/10 text-blue-700',
    'Pending':  'bg-amber-500/10 text-amber-700',
  };
  return (
    <Badge variant="secondary" className={`border-0 ${styles[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </Badge>
  );
};

const OpenOrdersReport = () => {
  const [overdueOnly,   setOverdueOnly]   = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<'All' | 'Approved' | 'Pending'>('All');

  const { data = [], isLoading } = useQuery({
    queryKey: ['report-open-orders'],
    queryFn:  () => getOpenOrders({}),
  });

  const rows = (Array.isArray(data) ? data : []) as OpenOrderRow[];

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const overdueMatch = !overdueOnly || r.OverdueDays > 0;
        const statusMatch  = statusFilter === 'All' || r.Status === statusFilter;
        return overdueMatch && statusMatch;
      })
      .sort((a, b) => b.OverdueDays - a.OverdueDays);
  }, [rows, overdueOnly, statusFilter]);

  const totals = useMemo(() => ({
    orderValue:  filteredRows.reduce((s, r) => s + parseFloat(r.EstimatedOrderValue), 0),
    approved:    filteredRows.filter((r) => r.Status === 'Approved').length,
    pending:     filteredRows.filter((r) => r.Status === 'Pending').length,
    avgOverdue:  filteredRows.length
      ? Math.round(filteredRows.reduce((s, r) => s + r.OverdueDays, 0) / filteredRows.length)
      : 0,
    lineItems:   filteredRows.reduce((s, r) => s + r.TotalLineItems, 0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Open Orders Report" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Open Orders Report"
          breadcrumbs={['Reports', 'Open Orders']}
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

          {/* PO status toggle pills */}
          <div className="flex items-center gap-2">
            {(['All', 'Approved', 'Pending'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === s
                    ? s === 'Approved'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : s === 'Pending'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <ExportCSV data={filteredRows} filename="open-orders" />
        </div>

        {/* Summary pills */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {filteredRows.length} order{filteredRows.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="bg-destructive/10 text-destructive">
              {formatCurrency(totals.orderValue)} estimated value
            </Badge>
            {totals.approved > 0 && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-700">
                {totals.approved} approved
              </Badge>
            )}
            {totals.pending > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                {totals.pending} awaiting approval
              </Badge>
            )}
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              avg {totals.avgOverdue}d overdue
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {totals.lineItems} total line items
            </Badge>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">PO Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Value</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
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
                      ? 'No open orders. All purchase orders have been delivered.'
                      : 'No orders match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const rowBg =
                    r.OverdueDays > 365 ? 'bg-destructive/5'  :
                    r.DueStatus === 'Overdue'   ? 'bg-amber-500/5'  :
                    r.DueStatus === 'Due Soon'  ? 'bg-amber-500/5'  : '';

                  return (
                    <tr
                      key={r.POID}
                      className={`border-b transition-colors hover:bg-muted/40 ${rowBg}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        PO-{String(r.POID).padStart(4, '0')}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.SupplierName}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <POStatusBadge status={r.Status} />
                          {r.ApprovedBy ? (
                            <span className="text-xs text-muted-foreground">{r.ApprovedBy}</span>
                          ) : (
                            <span className="text-xs text-amber-600 italic">unapproved</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.PODate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.ExpectedDate)}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {r.TotalLineItems}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(parseFloat(r.EstimatedOrderValue))}
                      </td>
                      <td className="px-4 py-3">
                        <DueStatusBadge status={r.DueStatus} days={r.OverdueDays} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.CreatedBy}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate"
                          title={r.Notes ?? ''}>
                        {r.Notes ?? <span className="italic">—</span>}
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
                    {filteredRows.length} order{filteredRows.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-center">{totals.lineItems}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(totals.orderValue)}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs font-normal text-muted-foreground">
                    {totals.approved} approved · {totals.pending} pending · avg {totals.avgOverdue}d overdue
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

export default OpenOrdersReport;
