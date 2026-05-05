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
  BankTransferTotal: string;
  CashTotal:         string;
  ChequeTotal:       string;
  MonthName:         string;
  PaymentMonth:      number;
  PaymentYear:       number;
  TotalAmountPaid:   string;
  TotalPayments:     number;
  UniqueSuppliersPaid: number;
};

const MonthlyExpenditureReport = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['report-monthly-expenditure'],
    queryFn:  () => getMonthlyExpenditure({}),
  });

  const rows = (Array.isArray(data) ? data : []) as ExpenditureRow[];

  // Year options derived from data
  const yearOptions = useMemo(() => {
    return [...new Set(rows.map((r) => String(r.PaymentYear)))]
      .sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (year === 'all') return [...rows].sort((a, b) =>
      a.PaymentYear !== b.PaymentYear
        ? a.PaymentYear - b.PaymentYear
        : a.PaymentMonth - b.PaymentMonth
    );
    return rows
      .filter((r) => String(r.PaymentYear) === year)
      .sort((a, b) => a.PaymentMonth - b.PaymentMonth);
  }, [rows, year]);

  // Chart data
  const chartData = useMemo(() =>
    filteredRows.map((r) => ({
      month:           `${r.MonthName.slice(0, 3)} ${r.PaymentYear}`,
      TotalAmountPaid: parseFloat(r.TotalAmountPaid),
      BankTransfer:    parseFloat(r.BankTransferTotal),
      Cheque:          parseFloat(r.ChequeTotal),
      Cash:            parseFloat(r.CashTotal),
    })),
  [filteredRows]);

  // Grand totals
  const totals = useMemo(() => ({
    paid:         filteredRows.reduce((s, r) => s + parseFloat(r.TotalAmountPaid),   0),
    bankTransfer: filteredRows.reduce((s, r) => s + parseFloat(r.BankTransferTotal), 0),
    cheque:       filteredRows.reduce((s, r) => s + parseFloat(r.ChequeTotal),       0),
    cash:         filteredRows.reduce((s, r) => s + parseFloat(r.CashTotal),         0),
    payments:     filteredRows.reduce((s, r) => s + r.TotalPayments,                 0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Monthly Expenditure" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Monthly Expenditure Report"
          breadcrumbs={['Reports', 'Monthly Expenditure']}
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
          <ExportCSV data={filteredRows} filename={`monthly-expenditure-${year}`} />
        </div>

        {/* Summary pills */}
        {!isLoading && filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {totals.payments} payments
            </Badge>
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

        {/* Chart */}
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
                        name === 'TotalAmountPaid' ? 'Total Paid'
                          : name === 'BankTransfer' ? 'Bank Transfer'
                          : name,
                      ]}
                    />
                    <Legend
                      formatter={(name) =>
                        name === 'TotalAmountPaid' ? 'Total Paid'
                          : name === 'BankTransfer' ? 'Bank Transfer'
                          : name
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="TotalAmountPaid"
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

        {/* Table */}
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
                filteredRows.map((r) => {
                  const bankTransfer = parseFloat(r.BankTransferTotal);
                  const cheque       = parseFloat(r.ChequeTotal);
                  const cash         = parseFloat(r.CashTotal);
                  const total        = parseFloat(r.TotalAmountPaid);

                  return (
                    <tr
                      key={`${r.PaymentYear}-${r.PaymentMonth}`}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-medium">
                        {r.MonthName} {r.PaymentYear}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.TotalPayments}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.UniqueSuppliersPaid}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {bankTransfer > 0
                          ? <span className="text-blue-600">{formatCurrency(bankTransfer)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cheque > 0
                          ? <span className="text-purple-600">{formatCurrency(cheque)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cash > 0
                          ? <span className="text-emerald-600">{formatCurrency(cash)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  );
                })
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
