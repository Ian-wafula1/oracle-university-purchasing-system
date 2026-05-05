import api from './client';

export const getItems = (params?: Record<string, string>) =>
  api.get('/items', { params }).then(r => r.data.data);
export const createItem = (body: Record<string, unknown>) =>
  api.post('/items', body).then(r => r.data.data);
export const updateItem = (id: number, body: Record<string, unknown>) =>
  api.put(`/items/${id}`, body).then(r => r.data.data);
export const deleteItem = (id: number) =>
  api.delete(`/items/${id}`).then(r => r.data.data);
