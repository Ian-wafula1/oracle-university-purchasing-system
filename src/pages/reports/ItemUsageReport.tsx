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
  averageunitprice:     number;
  category:             string;
  firstorderdate:       string;
  highestunitprice:     number;
  itemid:               number;
  itemname:             string;
  lastorderdate:        string;
  lowestunitprice:      number;
  timespurchased:       number;
  totalamountspent:     number;
  totalquantityordered: number;
  uniquesuppliers:      number;
  unit:                 string;
};

const CATEGORY_COLOURS: Record<string, string> = {
  'IT Supplies': 'bg-blue-500/10 text-blue-700',
  'Hygiene':     'bg-emerald-500/10 text-emerald-700',
  'Stationery':  'bg-purple-500/10 text-purple-700',
  'Electrical':  'bg-amber-500/10 text-amber-700',
  'Furniture':   'bg-orange-500/10 text-orange-700',
  'Safety':      'bg-red-500/10 text-red-700',
};

const CATEGORY_HSL: Record<string, string> = {
  'IT Supplies': '215 70% 38%',
  'Hygiene':     '152 60% 40%',
  'Stationery':  '262 52% 47%',
  'Electrical':  '38 92% 50%',
  'Furniture':   '24 90% 50%',
  'Safety':      '0 72% 51%',
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

  const { data: rows = [], isLoading } = useQuery<ItemUsageRow[]>({
    queryKey: ['report-item-usage'],
    queryFn:  () => getItemUsage({}),
  });

  const categories = useMemo(() =>
    [...new Set(rows.map((r) => r.category))].sort(),
  [rows]);

  const filteredRows = useMemo(() =>
    category === 'all'
      ? rows
      : rows.filter((r) => r.category === category),
  [rows, category]);

  const chartData = useMemo(() =>
    [...filteredRows]
      .sort((a, b) => b.totalamountspent - a.totalamountspent)
      .slice(0, 12)
      .map((r) => ({
        name:  r.itemname.length > 22 ? r.itemname.slice(0, 22) + '…' : r.itemname,
        Spent: r.totalamountspent,
        fill:  `hsl(${CATEGORY_HSL[r.category] ?? '215 70% 38%'})`,
      })),
  [filteredRows]);

  const totals = useMemo(() => ({
    spent:     filteredRows.reduce((s, r) => s + r.totalamountspent,     0),
    qty:       filteredRows.reduce((s, r) => s + r.totalquantityordered, 0),
    purchases: filteredRows.reduce((s, r) => s + r.timespurchased,       0),
  }), [filteredRows]);

  return (
    <>
      <TopBar title="Item Usage Report" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Item Usage Report"
          breadcrumbs={['Reports', 'Item Usage']}
        />

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
                    <Bar dataKey="Spent" radius={[0, 4, 4, 0]} fill="hsl(215 70% 38%)">
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
                  const priceVariance = r.highestunitprice > r.lowestunitprice;
                  return (
                    <tr key={r.itemid} className="border-b transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{r.itemname}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={r.category} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.unit}</td>
                      <td className="px-4 py-3 text-right">{r.totalquantityordered.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.timespurchased}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(r.averageunitprice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {priceVariance ? (
                          <span className="text-amber-600 text-xs">
                            {formatCurrency(r.lowestunitprice)} – {formatCurrency(r.highestunitprice)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {formatCurrency(r.lowestunitprice)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.uniquesuppliers > 1 ? (
                          <span className="text-blue-600 font-medium">{r.uniquesuppliers}</span>
                        ) : (
                          <span className="text-muted-foreground">{r.uniquesuppliers}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(r.totalamountspent)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(r.lastorderdate)}
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
