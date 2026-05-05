import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: string[];
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}

export const PageHeader = ({ title, breadcrumbs, action }: PageHeaderProps) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb}
            </span>
          ))}
        </div>
      )}
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    </div>
    {action && (
      <Button onClick={action.onClick} className="gap-2">
        {action.icon}
        {action.label}
      </Button>
    )}
  </div>
);
