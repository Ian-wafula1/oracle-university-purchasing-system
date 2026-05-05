import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileX } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, isLoading, onRowClick, emptyMessage = 'No data found', rowClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => <TableHead key={col.key}>{col.header}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map(col => (
                  <TableCell key={col.key}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
        <FileX className="h-10 w-10 mb-3" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col.key} className="font-semibold text-xs uppercase tracking-wider">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              className={`${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} ${rowClassName?.(row) || ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <TableCell key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
