import api from './client';

export const getInvoices = (params?: Record<string, string>) =>
  api.get('/invoices', { params }).then(r => r.data.data);
export const getInvoice = (id: number) =>
  api.get(`/invoices/${id}`).then(r => r.data.data);
export const createInvoice = (body: Record<string, unknown>) =>
  api.post('/invoices', body).then(r => r.data.data);
export const updateInvoice = (id: number, body: Record<string, unknown>) =>
  api.put(`/invoices/${id}`, body).then(r => r.data.data);
export const getUnpaidInvoices = () =>
  api.get('/invoices/unpaid').then(r => r.data.data);
