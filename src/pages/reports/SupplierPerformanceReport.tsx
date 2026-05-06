import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupplierPerformance } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SupplierPerformanceRow = {
  activecontracts:   number;
  deliveredorders:   number;
  disputedinvoices:  number;
  expiredcontracts:  number;
  ontimedeliveries:  number;
  openorders:        number;
  performancerating: string;
  supplierid:        number;
  suppliername:      string;
  supplierstatus:    string;
  totalinvoiced:     number;
  totalinvoices:     number;
  totalorders:       number;
  totaloutstanding:  number;
  totalpaid:         number;
};

const RATINGS = ['All', 'Excellent', 'Good', 'Needs Improvement', 'Review Needed'];

const RatingBadge = ({ rating }: { rating: string }) => {
  const styles: Record<string, string> = {
    'Excellent':         'bg-emerald-500/10 text-emerald-700',
    'Good':              'bg-blue-500/10 text-blue-700',
    'Needs Improvement': 'bg-amber-500/10 text-amber-700',
    'Review Needed':     'bg-destructive/10 text-destructive',
  };
  return (
    <Badge variant="secondary" className={`border-0 ${styles[rating] ?? 'bg-muted text-muted-foreground'}`}>
      {rating}
    </Badge>
  );
};

const DeliveryBar = ({ delivered, total }: { delivered: number; total: number }) => {
  if (total === 0) return <span className="text-muted-foreground text-xs">No orders</span>;
  const pct = Math.round((delivered / total) * 100);
  const colour = pct === 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-blue-500' : pct >= 50 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{delivered}/{total}</span>
    </div>
  );
};

const SupplierPerformanceReport = () => {
  const [rating, setRating] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['report-supplier-perf'],
    queryFn:  () => getSupplierPerformance({}),
  });

  // API returns a plain array directly
  const rows = (Array.isArray(data) ? data : []) as SupplierPerformanceRow[];

  const filteredRows = useMemo(() =>
    rating === 'All' ? rows : rows.filter((r) => r.performancerating === rating),
  [rows, rating]);

  const ratingCounts = useMemo(() =>
    RATINGS.slice(1).reduce((acc, r) => {
      acc[r] = rows.filter((row) => row.performancerating === r).length;
      return acc;
    }, {} as Record<string, number>),
  [rows]);

  const totals = useMemo(() => ({
    orders:      filteredRows.reduce((s, r) => s + r.totalorders,      0),
    delivered:   filteredRows.reduce((s, r) => s + r.deliveredorders,  0),
    onTime:      filteredRows.reduce((s, r) => s + r.ontimedeliveries, 0),
    invoiced:    filteredRows.reduce((s, r) => s + r.totalinvoiced,    0),
    paid:        filteredRows.reduce((s, r) => s + r.totalpaid,        0),
    outstanding: filteredRows.reduce((s, r) => s + r.totaloutstanding, 0),
    disputed:    filteredRows.reduce((s, r) => s + r.disputedinvoices, 0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Supplier Performance" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Supplier Performance Report"
          breadcrumbs={['Reports', 'Supplier Performance']}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs mb-1 block">Rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All ratings" />
              </SelectTrigger>
              <SelectContent>
                {RATINGS.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-2">
                      {r}
                      {r !== 'All' && ratingCounts[r] > 0 && (
                        <span className="text-xs text-muted-foreground">({ratingCounts[r]})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportCSV data={filteredRows} filename="supplier-performance" />
        </div>

        {/* Rating summary pills */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2">
            {RATINGS.slice(1).map((r) => ratingCounts[r] > 0 && (
              <button
                key={r}
                onClick={() => setRating(rating === r ? 'All' : r)}
                className="focus:outline-none"
              >
                <Badge
                  variant="secondary"
                  className={`border-0 cursor-pointer transition-opacity ${
                    rating !== 'All' && rating !== r ? 'opacity-40' : ''
                  } ${
                    r === 'Excellent'         ? 'bg-emerald-500/10 text-emerald-700' :
                    r === 'Good'              ? 'bg-blue-500/10 text-blue-700' :
                    r === 'Needs Improvement' ? 'bg-amber-500/10 text-amber-700' :
                                                'bg-destructive/10 text-destructive'
                  }`}
                >
                  {ratingCounts[r]} {r}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Rating</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Contracts</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Delivery Rate</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">On Time</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Disputes</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Invoiced</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No suppliers found for the selected rating.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const noActivity = r.totalorders === 0 && r.totalinvoices === 0;
                  const rowBg =
                    r.disputedinvoices > 0  ? 'bg-destructive/5' :
                    r.totaloutstanding > 0  ? 'bg-amber-500/5'   :
                    noActivity              ? 'opacity-60'       : '';

                  return (
                    <tr
                      key={r.supplierid}
                      className={`border-b transition-colors hover:bg-muted/40 ${rowBg}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{r.suppliername}</span>
                        {noActivity && (
                          <span className="ml-2 text-xs text-muted-foreground italic">no activity</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RatingBadge rating={r.performancerating} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-600 font-medium">{r.activecontracts}</span>
                        <span className="text-muted-foreground"> active</span>
                        {r.expiredcontracts > 0 && (
                          <span className="text-muted-foreground text-xs block">
                            {r.expiredcontracts} expired
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DeliveryBar delivered={r.deliveredorders} total={r.totalorders} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.totalorders > 0 ? (
                          <span className={r.ontimedeliveries === r.deliveredorders ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                            {r.ontimedeliveries}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.disputedinvoices > 0 ? (
                          <span className="text-destructive font-medium">{r.disputedinvoices}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.totalinvoiced > 0
                          ? formatCurrency(r.totalinvoiced)
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {r.totalpaid > 0
                          ? formatCurrency(r.totalpaid)
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.totaloutstanding > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(r.totaloutstanding)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
                  <td className="px-4 py-3" colSpan={2}>{filteredRows.length} suppliers</td>
                  <td className="px-4 py-3 text-center text-muted-foreground text-xs font-normal">—</td>
                  <td className="px-4 py-3">
                    <DeliveryBar delivered={totals.delivered} total={totals.orders} />
                  </td>
                  <td className="px-4 py-3 text-center">{totals.onTime}</td>
                  <td className="px-4 py-3 text-center text-destructive">
                    {totals.disputed > 0 ? totals.disputed : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.invoiced)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.paid)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {totals.outstanding > 0 ? formatCurrency(totals.outstanding) : '—'}
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

export default SupplierPerformanceReport;
