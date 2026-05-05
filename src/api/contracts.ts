import api from './client';

export const getContracts = (params?: Record<string, string>) =>
  api.get('/contracts', { params }).then(r => r.data.data);
export const getContract = (id: number) =>
  api.get(`/contracts/${id}`).then(r => r.data.data);
export const createContract = (body: Record<string, unknown>) =>
  api.post('/contracts', body).then(r => r.data.data);
export const updateContract = (id: number, body: Record<string, unknown>) =>
  api.put(`/contracts/${id}`, body).then(r => r.data.data);
export const getContractItems = (id: number) =>
  api.get(`/contracts/${id}/items`).then(r => r.data.data);
export const addContractItem = (id: number, body: Record<string, unknown>) =>
  api.post(`/contracts/${id}/items`, body).then(r => r.data.data);
export const deleteContractItem = (id: number) =>
  api.delete(`/contract-items/${id}`).then(r => r.data.data);
