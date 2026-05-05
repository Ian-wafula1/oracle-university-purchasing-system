import { useQuery } from '@tanstack/react-query';
import { getActiveContracts } from '@/api/reports';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { ExportCSV } from '@/components/ExportCSV';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/format';

const ActiveContractsReport = () => {
	const { data = [], isLoading } = useQuery({
		queryKey: ['report-active-contracts'],
		queryFn: getActiveContracts,
	});

	const getDaysLabel = (days: number) => {
		if (days < 0) return `Expired ${Math.abs(days)}d ago`;
		if (days === 0) return 'Expires today';
		return `${days}d left`;
	};

	const getDaysClassName = (days: number) => {
		if (days < 0) return 'text-destructive font-semibold';
		if (days <= 30) return 'text-amber-600 font-semibold';
		return 'text-emerald-600';
	};

	const getRowClassName = (r: Record<string, unknown>) => {
		const days = Number(r.DaysUntilExpiry);
		if (days < 0) return 'bg-destructive/5';
		if (days <= 30) return 'bg-amber-500/5';
		return '';
	};

	const columns: Column<Record<string, unknown>>[] = [
		{ key: 'ContractNumber', header: 'Contract #' },
		{ key: 'SupplierName', header: 'Supplier' },
		{ key: 'SupplierEmail', header: 'Email' },
		{
			key: 'TotalItemsCovered',
			header: 'Items',
			render: (r) => <span className="text-muted-foreground">{String(r.TotalItemsCovered)}</span>,
		},
		{
			key: 'ContractStatus',
			header: 'Status',
			render: (r) => <StatusBadge status={String(r.ContractStatus || '')} />,
		},
	];

	const expiringSoon = (data as Record<string, unknown>[]).filter((r) => Number(r.DaysUntilExpiry) >= 0 && Number(r.DaysUntilExpiry) <= 30).length;

	const expired = (data as Record<string, unknown>[]).filter((r) => Number(r.DaysUntilExpiry) < 0).length;

	return (
		<>
			<TopBar title="Active Contracts Report" />
			<div className="page-container">
				<PageHeader title="Active Contracts Report" breadcrumbs={['Reports', 'Active Contracts']} />

				{/* Summary pills */}
				{!isLoading && (
					<div className="mb-4 flex gap-3">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700">{(data as Record<string, unknown>[]).length} Active</span>
						{expiringSoon > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700">{expiringSoon} Expiring within 30 days</span>}
						{expired > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">{expired} Overdue</span>}
					</div>
				)}

				<div className="mb-4 flex justify-end">
					<ExportCSV data={data as Record<string, unknown>[]} filename="active-contracts" />
				</div>

				<DataTable columns={columns} data={data as Record<string, unknown>[]} isLoading={isLoading} rowClassName={getRowClassName} />
			</div>
		</>
	);
};

export default ActiveContractsReport;
