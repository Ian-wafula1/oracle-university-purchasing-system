import api from './client';

export const getActiveContracts = () =>
  api.get('/reports/active-contracts').then(r => r.data.data);
export const getInvoiceTotals = (params?: Record<string, string>) =>
  api.get('/reports/invoice-totals', { params }).then(r => r.data.data);
export const getItemUsage = (params?: Record<string, string>) =>
  api.get('/reports/item-usage', { params }).then(r => r.data.data);
export const getMonthlyExpenditure = (params?: Record<string, string>) =>
  api.get('/reports/monthly-expenditure', { params }).then(r => r.data.data);
export const getOpenOrders = (params?: Record<string, string>) =>
  api.get('/reports/open-orders', { params }).then(r => r.data.data);
export const getUnpaidInvoicesReport = (params?: Record<string, string>) =>
  api.get('/reports/unpaid-invoices', { params }).then(r => r.data.data);
export const getSupplierPerformance = (params?: Record<string, string>) =>
  api.get('/reports/supplier-performance', { params }).then(r => r.data.data);
export const getPaymentHistory = (params?: Record<string, string>) =>
  api.get('/reports/payment-history', { params }).then(r => r.data.data);
export const getDashboard = () =>
  api.get('/dashboard').then(r => r.data.data);
