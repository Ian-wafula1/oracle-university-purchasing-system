import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportCSVProps {
  data: Record<string, unknown>[];
  filename: string;
  columns?: { key: string; header: string }[];
}

export const ExportCSV = ({ data, filename, columns }: ExportCSVProps) => {
  const handleExport = () => {
    if (!data.length) return;
    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);
    const headers = columns ? columns.map(c => c.header) : keys;
    const csvRows = [
      headers.join(','),
      ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
};
