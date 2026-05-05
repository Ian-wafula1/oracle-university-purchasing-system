import { format, parseISO } from 'date-fns';

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd MMM yyyy');
  } catch {
    return '—';
  }
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return 'KES 0.00';
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
