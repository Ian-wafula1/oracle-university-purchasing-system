import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { getInvoiceTotals } from '@/api/reports';
import { formatCurrency } from '@/lib/format';

type InvoiceTotalRow = {
  disputedcount: number;
  invoicemonth: number;
  invoiceyear: number;
  monthname: string;
  paidcount: number;
  receivedcount: number;
  supplierid: number;
  suppliername: string;
  totaldisputed: number;
  totalinvoiced: number;
  totalinvoices: number;
  totaloutstanding: number;
  totalpaid: number;
};

type ApiResponse = {
  success: boolean;
  message: string;
  data: InvoiceTotalRow[];
};

const InvoiceTotalsReport = () => {
  const [year, setYear] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const { data: responseData, isLoading } = useQuery<ApiResponse>({
    queryKey: ['report-invoice-totals'],
    queryFn: () => getInvoiceTotals({}),
  });

  console.log('responseData', responseData);

  const rows: InvoiceTotalRow[] = responseData ?? [];

  const yearOptions = useMemo(() => {
    const years = [...new Set(rows.map((r) => String(r.invoiceyear)))].sort((a, b) => Number(b) - Number(a));
    return years;
  }, [rows]);

  const supplierOptions = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach((r) => seen.set(r.supplierid, r.suppliername));
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const yearMatch     = year === 'all'          || String(r.invoiceyear) === year;
      const supplierMatch = supplierFilter === 'all' || String(r.supplierid) === supplierFilter;
      return yearMatch && supplierMatch;
    });
  }, [rows, year, supplierFilter]);

  const totals = useMemo(() => ({
    invoices:    filteredRows.reduce((s, r) => s + r.totalinvoices,    0),
    invoiced:    filteredRows.reduce((s, r) => s + r.totalinvoiced,    0),
    paid:        filteredRows.reduce((s, r) => s + r.totalpaid,        0),
    outstanding: filteredRows.reduce((s, r) => s + r.totaloutstanding, 0),
    disputed:    filteredRows.reduce((s, r) => s + r.totaldisputed,    0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Invoice Totals Report" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Invoice Totals Report"
          breadcrumbs={['Reports', 'Invoice Totals']}
        />

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
            <Label className="text-xs mb-1 block">Supplier</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
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

          <ExportCSV data={filteredRows} filename={`invoice-totals-${year}`} />
        </div>

        {!isLoading && filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{totals.invoices} invoices</Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {formatCurrency(totals.invoiced)} invoiced
            </Badge>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
              {formatCurrency(totals.paid)} paid
            </Badge>
            {totals.outstanding > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                {formatCurrency(totals.outstanding)} outstanding
              </Badge>
            )}
            {totals.disputed > 0 && (
              <Badge variant="destructive" className="bg-destructive/10 text-destructive">
                {formatCurrency(totals.disputed)} disputed
              </Badge>
            )}
          </div>
        )}

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"># Invoices</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Invoiced</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Disputed</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status Split</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No records found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const rowBg = r.totaldisputed > 0
                    ? 'bg-destructive/5'
                    : r.totaloutstanding > 0
                    ? 'bg-amber-500/5'
                    : '';

                  return (
                    <tr
                      key={`${r.supplierid}-${r.invoiceyear}-${r.invoicemonth}`}
                      className={`border-b transition-colors hover:bg-muted/40 ${rowBg}`}
                    >
                      <td className="px-4 py-3 font-medium">{r.suppliername}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.monthname} {r.invoiceyear}
                      </td>
                      <td className="px-4 py-3 text-right">{r.totalinvoices}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(r.totalinvoiced)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        {formatCurrency(r.totalpaid)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.totaloutstanding > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(r.totaloutstanding)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.totaldisputed > 0 ? (
                          <span className="text-destructive font-medium">{formatCurrency(r.totaldisputed)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">
                          {r.paidcount}P · {r.receivedcount}R · {r.disputedcount}D
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!isLoading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>Totals</td>
                  <td className="px-4 py-3 text-right">{totals.invoices}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.invoiced)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(totals.paid)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {totals.outstanding > 0 ? formatCurrency(totals.outstanding) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {totals.disputed > 0 ? formatCurrency(totals.disputed) : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default InvoiceTotalsReport;
