import api from './client';

export const getSuppliers = (params?: Record<string, string>) =>
  api.get('/suppliers', { params }).then(r => r.data.data);
export const getSupplier = (id: number) =>
  api.get(`/suppliers/${id}`).then(r => r.data.data);
export const createSupplier = (body: Record<string, unknown>) =>
  api.post('/suppliers', body).then(r => r.data.data);
export const updateSupplier = (id: number, body: Record<string, unknown>) =>
  api.put(`/suppliers/${id}`, body).then(r => r.data.data);
export const deleteSupplier = (id: number) =>
  api.delete(`/suppliers/${id}`).then(r => r.data.data);
export const approveSupplier = (id: number, body: Record<string, unknown>) =>
  api.put(`/suppliers/${id}/approve`, body).then(r => r.data.data);
