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
	console.log(data);

	const kpiCards = [
		{ title: 'Approved Suppliers', value: kpis.ApprovedSuppliers ?? 0, icon: Users },
		{ title: 'Active Contracts', value: kpis.ActiveContracts ?? 0, icon: FileSignature },
		{ title: 'Expiring Soon', value: kpis.ContractsExpiringSoon ?? 0, icon: Clock },
		{ title: 'Pending Orders', value: kpis.PendingOrders ?? 0, icon: ShoppingCart },
		{ title: 'Overdue Orders', value: kpis.OverdueOrders ?? 0, icon: AlertCircle },
		{ title: 'Unprocessed Invoices', value: kpis.UnprocessedInvoices ?? 0, icon: Receipt },
		{ title: 'Outstanding Balance', value: formatCurrency(kpis.TotalOutstanding), icon: Wallet },
		{ title: 'Payments This Month', value: formatCurrency(kpis.PaymentsThisMonth), icon: CreditCard },
	];

	const contractCols: Column<Record<string, unknown>>[] = [
		{ key: 'ContractNumber', header: 'Contract' },
		{ key: 'SupplierName', header: 'Supplier' },
		{ key: 'EndDate', header: 'End Date', render: (r) => formatDate(r.EndDate as string) },
		{ key: 'DaysUntilExpiry', header: 'Days Left', render: (r) => <span className={Number(r.DaysUntilExpiry) <= 30 ? 'text-destructive font-semibold' : ''}>{String(r.DaysUntilExpiry)}</span> },
	];

	const orderCols: Column<Record<string, unknown>>[] = [
		{ key: 'POID', header: 'PO#' },
		{ key: 'SupplierName', header: 'Supplier' },
		{ key: 'ExpectedDate', header: 'Expected', render: (r) => formatDate(r.ExpectedDate as string) },
		{ key: 'OverdueDays', header: 'Overdue Days' },
	];

	const invoiceCols: Column<Record<string, unknown>>[] = [
		{ key: 'InvoiceNumber', header: 'Invoice' },
		{ key: 'SupplierName', header: 'Supplier' },
		{ key: 'BalanceOutstanding', header: 'Balance', render: (r) => formatCurrency(r.BalanceOutstanding as number) },
		{ key: 'DaysOverdue', header: 'Overdue' },
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
											month: `${item.MonthName.slice(0, 3)} ${item.Year}`,
											amount: parseFloat(item.TotalPaid),
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
											<span className="text-sm font-medium">{String(s.SupplierName)}</span>
											<span className="text-sm text-muted-foreground">{formatCurrency(s.TotalSpend as number)}</span>
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
