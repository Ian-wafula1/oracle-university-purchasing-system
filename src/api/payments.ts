import api from './client';

export const getPayments = (params?: Record<string, string>) =>
  api.get('/payments', { params }).then(r => r.data.data);
export const getPayment = (id: number) =>
  api.get(`/payments/${id}`).then(r => r.data.data);
export const createPayment = (body: Record<string, unknown>) =>
  api.post('/payments', body).then(r => r.data.data);
export const getPaymentMethods = () =>
  api.get('/payments/methods').then(r => r.data.data);
