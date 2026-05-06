import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { StatCard } from '@/components/StatCard';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileSignature, Clock, ShoppingCart, AlertCircle, Receipt, Wallet, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DashboardPage = () => {
	const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

	const kpis = data?.kpis || {};
	const monthlyExpenditure = data?.monthly_trend || [];
	const expiringContracts = data?.expiring_contracts || [];
	const overdueOrders = data?.overdue_orders || [];
	const overdueInvoices = data?.overdue_invoices || [];
	const topSuppliers = data?.top_suppliers || [];

	const kpiCards = [
		{ title: 'Approved Suppliers', value: kpis.approvedsuppliers ?? 0, icon: Users },
		{ title: 'Active Contracts', value: kpis.activecontracts ?? 0, icon: FileSignature },
		{ title: 'Expiring Soon', value: kpis.contractsexpiringsoon ?? 0, icon: Clock },
		{ title: 'Pending Orders', value: kpis.pendingorders ?? 0, icon: ShoppingCart },
		{ title: 'Overdue Orders', value: kpis.overdueorders ?? 0, icon: AlertCircle },
		{ title: 'Unprocessed Invoices', value: kpis.unprocessedinvoices ?? 0, icon: Receipt },
		{ title: 'Outstanding Balance', value: formatCurrency(kpis.totaloutstanding), icon: Wallet },
		{ title: 'Payments This Month', value: formatCurrency(kpis.paymentsthismonth), icon: CreditCard },
	];

	const contractCols: Column<Record<string, unknown>>[] = [
		{ key: 'contractnumber', header: 'Contract' },
		{ key: 'suppliername', header: 'Supplier' },
		{ key: 'enddate', header: 'End Date', render: (r) => formatDate(r.enddate as string) },
		{ key: 'daysuntilexpiry', header: 'Days Left', render: (r) => <span className={Number(r.daysuntilexpiry) <= 30 ? 'text-destructive font-semibold' : ''}>{String(r.daysuntilexpiry)}</span> },
	];

	const orderCols: Column<Record<string, unknown>>[] = [
		{ key: 'poid', header: 'PO#' },
		{ key: 'suppliername', header: 'Supplier' },
		{ key: 'expecteddate', header: 'Expected', render: (r) => formatDate(r.expecteddate as string) },
		{ key: 'overduedays', header: 'Overdue Days' },
	];

	const invoiceCols: Column<Record<string, unknown>>[] = [
		{ key: 'invoicenumber', header: 'Invoice' },
		{ key: 'suppliername', header: 'Supplier' },
		{ key: 'invoiceamount', header: 'Amount', render: (r) => formatCurrency(r.invoiceamount as number) },
		{ key: 'daysoverdue', header: 'Overdue' },
	];

	return (
		<>
			<TopBar title="Dashboard" />
			<div className="page-container space-y-6">
				<div className="kpi-grid">
					{kpiCards.map((kpi) => (
						<StatCard key={kpi.title} {...kpi} />
					))}
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Monthly Expenditure (Last 6 Months)</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={monthlyExpenditure
										.map((item) => ({
											month: `${item.monthname.trim().slice(0, 3)} ${item.year}`,
											amount: parseFloat(item.totalpaid),
										}))
										.reverse()}>
									<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
									<XAxis dataKey="month" className="text-xs" />
									<YAxis className="text-xs" tickFormatter={(value) => `KES ${(value / 1000).toFixed(0)}k`} />
									<Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Total Paid']} />
									<Bar dataKey="amount" fill="hsl(215 70% 38%)" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Expiring Contracts</CardTitle>
						</CardHeader>
						<CardContent>
							<DataTable columns={contractCols} data={expiringContracts} isLoading={isLoading} emptyMessage="No expiring contracts" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Overdue Orders</CardTitle>
						</CardHeader>
						<CardContent>
							<DataTable columns={orderCols} data={overdueOrders} isLoading={isLoading} emptyMessage="No overdue orders" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Overdue Invoices</CardTitle>
						</CardHeader>
						<CardContent>
							<DataTable columns={invoiceCols} data={overdueInvoices} isLoading={isLoading} emptyMessage="No overdue invoices" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Top Suppliers by Spend</CardTitle>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<p className="text-sm text-muted-foreground">Loading...</p>
							) : (
								<div className="space-y-3">
									{topSuppliers.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
									{topSuppliers.map((s: Record<string, unknown>, i: number) => (
										<div key={i} className="flex items-center justify-between">
											<span className="text-sm font-medium">{String(s.suppliername)}</span>
											<span className="text-sm text-muted-foreground">{formatCurrency(s.totalspend as number)}</span>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
};

export default DashboardPage;
