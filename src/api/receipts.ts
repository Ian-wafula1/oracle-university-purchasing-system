import api from './client';

export const getReceipts = (params?: Record<string, string>) =>
  api.get('/receipts', { params }).then(r => r.data.data);
export const getReceipt = (id: number) =>
  api.get(`/receipts/${id}`).then(r => r.data.data);
export const createReceipt = (body: Record<string, unknown>) =>
  api.post('/receipts', body).then(r => r.data.data);
