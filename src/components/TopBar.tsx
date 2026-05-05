import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { StatusBadge } from '@/components/StatusBadge';

interface TopBarProps {
  title: string;
}

export const TopBar = ({ title }: TopBarProps) => {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <StatusBadge status={user.role} />
            <span className="text-sm text-muted-foreground">{user.username}</span>
          </>
        )}
      </div>
    </header>
  );
};
