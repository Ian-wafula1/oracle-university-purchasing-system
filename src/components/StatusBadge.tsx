import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        destructive: 'bg-destructive/15 text-destructive',
        info: 'bg-info/15 text-info',
        default: 'bg-muted text-muted-foreground',
        accent: 'bg-accent/15 text-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const STATUS_MAP: Record<string, VariantProps<typeof statusBadgeVariants>['variant']> = {
  Approved: 'success', Active: 'info', Delivered: 'success', Paid: 'success', 'On Time': 'success',
  Pending: 'warning', 'Due Soon': 'warning', Applied: 'warning', 'Needs Improvement': 'warning',
  Rejected: 'destructive', Suspended: 'destructive', Overdue: 'destructive', Late: 'destructive', 'Review Needed': 'destructive',
  Disputed: 'warning', Expired: 'default', Cancelled: 'default',
  Excellent: 'success', Good: 'info',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const variant = STATUS_MAP[status] || 'default';
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{status}</span>;
};
