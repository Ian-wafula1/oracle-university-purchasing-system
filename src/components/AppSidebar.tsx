import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, FileText, Package, FileSignature,
  ShoppingCart, Receipt, CreditCard, FileCheck,
  BarChart3, TrendingUp, Boxes, Calendar, ClipboardList,
  AlertCircle, Star, History, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { title: 'Suppliers', url: '/suppliers', icon: Users },
      { title: 'Applications', url: '/applications', icon: FileText },
      { title: 'Items', url: '/items', icon: Package },
      { title: 'Contracts', url: '/contracts', icon: FileSignature },
      { title: 'Purchase Orders', url: '/purchase-orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Finance',
    items: [
      { title: 'Invoices', url: '/invoices', icon: Receipt },
      { title: 'Payments', url: '/payments', icon: CreditCard },
      { title: 'Receipts', url: '/receipts', icon: FileCheck },
    ],
  },
  {
    label: 'Reports',
    items: [
      { title: 'Active Contracts', url: '/reports/active-contracts', icon: BarChart3 },
      { title: 'Invoice Totals', url: '/reports/invoice-totals', icon: TrendingUp },
      { title: 'Item Usage', url: '/reports/item-usage', icon: Boxes },
      { title: 'Monthly Expenditure', url: '/reports/monthly-expenditure', icon: Calendar },
      { title: 'Open Orders', url: '/reports/open-orders', icon: ClipboardList },
      { title: 'Unpaid Invoices', url: '/reports/unpaid-invoices', icon: AlertCircle },
      { title: 'Supplier Performance', url: '/reports/supplier-performance', icon: Star },
      { title: 'Payment History', url: '/reports/payment-history', icon: History },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-sm tracking-tight">UniProcure</span>}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">
              {!collapsed && group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-xs text-sidebar-muted truncate">{user.username}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent gap-2"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Logout'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
