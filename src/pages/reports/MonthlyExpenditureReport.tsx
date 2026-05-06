import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMonthlyExpenditure } from '@/api/reports';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type ExpenditureRow = {
  banktransfertotal:   number;
  cashtotal:           number;
  chequetotal:         number;
  monthname:           string;
  paymentmonth:        number;
  paymentyear:         number;
  totalamountpaid:     number;
  totalpayments:       number;
  uniquesupplierspaid: number;
};

const MonthlyExpenditureReport = () => {
  const [year, setYear] = useState('all');

  const { data: rows = [], isLoading } = useQuery<ExpenditureRow[]>({
    queryKey: ['report-monthly-expenditure'],
    queryFn:  () => getMonthlyExpenditure({}),
  });

  const yearOptions = useMemo(() =>
    [...new Set(rows.map((r) => String(r.paymentyear)))]
      .sort((a, b) => Number(b) - Number(a)),
  [rows]);

  const filteredRows = useMemo(() => {
    const sorted = year === 'all'
      ? [...rows]
      : rows.filter((r) => String(r.paymentyear) === year);
    return sorted.sort((a, b) =>
      a.paymentyear !== b.paymentyear
        ? a.paymentyear - b.paymentyear
        : a.paymentmonth - b.paymentmonth
    );
  }, [rows, year]);

  const chartData = useMemo(() =>
    filteredRows.map((r) => ({
      month:        `${r.monthname.slice(0, 3)} ${r.paymentyear}`,
      TotalPaid:    r.totalamountpaid,
      BankTransfer: r.banktransfertotal,
      Cheque:       r.chequetotal,
      Cash:         r.cashtotal,
    })),
  [filteredRows]);

  const totals = useMemo(() => ({
    paid:         filteredRows.reduce((s, r) => s + r.totalamountpaid,   0),
    bankTransfer: filteredRows.reduce((s, r) => s + r.banktransfertotal, 0),
    cheque:       filteredRows.reduce((s, r) => s + r.chequetotal,       0),
    cash:         filteredRows.reduce((s, r) => s + r.cashtotal,         0),
    payments:     filteredRows.reduce((s, r) => s + r.totalpayments,     0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Monthly Expenditure" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Monthly Expenditure Report"
          breadcrumbs={['Reports', 'Monthly Expenditure']}
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
          <ExportCSV data={filteredRows} filename={`monthly-expenditure-${year}`} />
        </div>

        {!isLoading && filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{totals.payments} payments</Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {formatCurrency(totals.paid)} total spend
            </Badge>
            {totals.bankTransfer > 0 && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-700">
                {formatCurrency(totals.bankTransfer)} bank transfer
              </Badge>
            )}
            {totals.cheque > 0 && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-700">
                {formatCurrency(totals.cheque)} cheque
              </Badge>
            )}
            {totals.cash > 0 && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
                {formatCurrency(totals.cash)} cash
              </Badge>
            )}
          </div>
        )}

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Expenditure Trend {year !== 'all' ? `— ${year}` : '(All Years)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      className="text-xs"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'TotalPaid' ? 'Total Paid'
                          : name === 'BankTransfer' ? 'Bank Transfer'
                          : name,
                      ]}
                    />
                    <Legend
                      formatter={(name) =>
                        name === 'TotalPaid' ? 'Total Paid'
                          : name === 'BankTransfer' ? 'Bank Transfer'
                          : name
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="TotalPaid"
                      stroke="hsl(215 70% 38%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    {totals.bankTransfer > 0 && (
                      <Line
                        type="monotone"
                        dataKey="BankTransfer"
                        stroke="hsl(199 89% 48%)"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                      />
                    )}
                    {totals.cheque > 0 && (
                      <Line
                        type="monotone"
                        dataKey="Cheque"
                        stroke="hsl(262 52% 47%)"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                      />
                    )}
                    {totals.cash > 0 && (
                      <Line
                        type="monotone"
                        dataKey="Cash"
                        stroke="hsl(152 60% 40%)"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"># Payments</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Suppliers Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Bank Transfer</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cheque</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cash</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No records found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr
                    key={`${r.paymentyear}-${r.paymentmonth}`}
                    className="border-b transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{r.monthname} {r.paymentyear}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.totalpayments}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.uniquesupplierspaid}</td>
                    <td className="px-4 py-3 text-right">
                      {r.banktransfertotal > 0
                        ? <span className="text-blue-600">{formatCurrency(r.banktransfertotal)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.chequetotal > 0
                        ? <span className="text-purple-600">{formatCurrency(r.chequetotal)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.cashtotal > 0
                        ? <span className="text-emerald-600">{formatCurrency(r.cashtotal)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(r.totalamountpaid)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!isLoading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3">Totals</td>
                  <td className="px-4 py-3 text-right">{totals.payments}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right text-blue-600">
                    {totals.bankTransfer > 0 ? formatCurrency(totals.bankTransfer) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-purple-600">
                    {totals.cheque > 0 ? formatCurrency(totals.cheque) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {totals.cash > 0 ? formatCurrency(totals.cash) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.paid)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default MonthlyExpenditureReport;
