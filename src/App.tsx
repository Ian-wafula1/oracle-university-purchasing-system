import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import SuppliersPage from "@/pages/SuppliersPage";
import SupplierDetailPage from "@/pages/SupplierDetailPage";
import ApplicationsPage from "@/pages/ApplicationsPage";
import ItemsPage from "@/pages/ItemsPage";
import ContractsPage from "@/pages/ContractsPage";
import ContractDetailPage from "@/pages/ContractDetailPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import PODetailPage from "@/pages/PODetailPage";
import InvoicesPage from "@/pages/InvoicesPage";
import InvoiceDetailPage from "@/pages/InvoiceDetailPage";
import PaymentsPage from "@/pages/PaymentsPage";
import PaymentDetailPage from "@/pages/PaymentDetailPage";
import ReceiptsPage from "@/pages/ReceiptsPage";
import ReceiptDetailPage from "@/pages/ReceiptDetailPage";
import ActiveContractsReport from "@/pages/reports/ActiveContractsReport";
import InvoiceTotalsReport from "@/pages/reports/InvoiceTotalsReport";
import ItemUsageReport from "@/pages/reports/ItemUsageReport";
import MonthlyExpenditureReport from "@/pages/reports/MonthlyExpenditureReport";
import OpenOrdersReport from "@/pages/reports/OpenOrdersReport";
import UnpaidInvoicesReport from "@/pages/reports/UnpaidInvoicesReport";
import SupplierPerformanceReport from "@/pages/reports/SupplierPerformanceReport";
import PaymentHistoryReport from "@/pages/reports/PaymentHistoryReport";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
  // return <> {children} </>;
};

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/:id" element={<PODetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/:id" element={<PaymentDetailPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
        <Route path="/reports/active-contracts" element={<ActiveContractsReport />} />
        <Route path="/reports/invoice-totals" element={<InvoiceTotalsReport />} />
        <Route path="/reports/item-usage" element={<ItemUsageReport />} />
        <Route path="/reports/monthly-expenditure" element={<MonthlyExpenditureReport />} />
        <Route path="/reports/open-orders" element={<OpenOrdersReport />} />
        <Route path="/reports/unpaid-invoices" element={<UnpaidInvoicesReport />} />
        <Route path="/reports/supplier-performance" element={<SupplierPerformanceReport />} />
        <Route path="/reports/payment-history" element={<PaymentHistoryReport />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{
            style: { background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', border: '1px solid hsl(var(--border))' },
          }} />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
