import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getItemUsage } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { ExportCSV } from '@/components/ExportCSV';
import { formatDate, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type ItemUsageRow = {
  AverageUnitPrice:    string;
  Category:            string;
  FirstOrderDate:      string;
  HighestUnitPrice:    string;
  ItemID:              number;
  ItemName:            string;
  LastOrderDate:       string;
  LowestUnitPrice:     string;
  TimesPurchased:      number;
  TotalAmountSpent:    string;
  TotalQuantityOrdered:number;
  UniqueSuppliers:     number;
  Unit:                string;
};

const CATEGORY_COLOURS: Record<string, string> = {
  'IT Supplies': 'bg-blue-500/10 text-blue-700',
  'Hygiene':     'bg-emerald-500/10 text-emerald-700',
  'Stationery':  'bg-purple-500/10 text-purple-700',
  'Electrical':  'bg-amber-500/10 text-amber-700',
  'Furniture':   'bg-orange-500/10 text-orange-700',
  'Safety':      'bg-red-500/10 text-red-700',
};

const CategoryBadge = ({ category }: { category: string }) => (
  <Badge
    variant="secondary"
    className={`border-0 ${CATEGORY_COLOURS[category] ?? 'bg-muted text-muted-foreground'}`}
  >
    {category}
  </Badge>
);

const ItemUsageReport = () => {
  const [category, setCategory] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['report-item-usage'],
    queryFn:  () => getItemUsage({}),
  });

  const rows = (Array.isArray(data) ? data : []) as ItemUsageRow[];

  // Derive categories from data
  const categories = useMemo(() =>
    [...new Set(rows.map((r) => r.Category))].sort(),
  [rows]);

  // Filtered rows
  const filteredRows = useMemo(() =>
    category === 'all'
      ? rows
      : rows.filter((r) => r.Category === category),
  [rows, category]);

  // Chart data — top 12 by spend, truncate name for readability
  const chartData = useMemo(() =>
    [...filteredRows]
      .sort((a, b) => parseFloat(b.TotalAmountSpent) - parseFloat(a.TotalAmountSpent))
      .slice(0, 12)
      .map((r) => ({
        name:  r.ItemName.length > 22 ? r.ItemName.slice(0, 22) + '…' : r.ItemName,
        Spent: parseFloat(r.TotalAmountSpent),
        fill:  CATEGORY_COLOURS[r.Category]
          ? `hsl(${
              r.Category === 'IT Supplies' ? '215 70% 38%' :
              r.Category === 'Hygiene'     ? '152 60% 40%' :
              r.Category === 'Stationery'  ? '262 52% 47%' :
              r.Category === 'Electrical'  ? '38 92% 50%'  :
              r.Category === 'Furniture'   ? '24 90% 50%'  :
                                             '0 72% 51%'
            })`
          : 'hsl(215 70% 38%)',
      })),
  [filteredRows]);

  // Grand totals
  const totals = useMemo(() => ({
    spent:     filteredRows.reduce((s, r) => s + parseFloat(r.TotalAmountSpent),     0),
    qty:       filteredRows.reduce((s, r) => s + r.TotalQuantityOrdered,             0),
    purchases: filteredRows.reduce((s, r) => s + r.TimesPurchased,                   0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Item Usage Report" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Item Usage Report"
          breadcrumbs={['Reports', 'Item Usage']}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs mb-1 block">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportCSV data={filteredRows} filename="item-usage" />
        </div>

        {/* Summary pills */}
        {!isLoading && filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {formatCurrency(totals.spent)} total spend
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {totals.qty.toLocaleString()} units ordered
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {totals.purchases} purchase{totals.purchases !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Top {chartData.length} Items by Spend
                {category !== 'all' && ` — ${category}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Total Spent']}
                    />
                    <Bar dataKey="Spent" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Ordered</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"># Purchases</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Price</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price Range</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Suppliers</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Spent</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Ordered</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
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
                      ? 'No item usage data available.'
                      : 'No items found for the selected category.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const low  = parseFloat(r.LowestUnitPrice);
                  const high = parseFloat(r.HighestUnitPrice);
                  const priceVariance = high > low;

                  return (
                    <tr
                      key={r.ItemID}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-medium">{r.ItemName}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={r.Category} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.Unit}</td>
                      <td className="px-4 py-3 text-right">
                        {r.TotalQuantityOrdered.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.TimesPurchased}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(parseFloat(r.AverageUnitPrice))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {priceVariance ? (
                          <span className="text-amber-600 text-xs">
                            {formatCurrency(low)} – {formatCurrency(high)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {formatCurrency(low)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.UniqueSuppliers > 1 ? (
                          <span className="text-blue-600 font-medium">{r.UniqueSuppliers}</span>
                        ) : (
                          <span className="text-muted-foreground">{r.UniqueSuppliers}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(parseFloat(r.TotalAmountSpent))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(r.LastOrderDate)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!isLoading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>
                    {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right">{totals.qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{totals.purchases}</td>
                  <td className="px-4 py-3" colSpan={3} />
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.spent)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default ItemUsageReport;
