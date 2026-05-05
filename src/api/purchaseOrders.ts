import api from './client';

export const getPurchaseOrders = (params?: Record<string, string>) =>
  api.get('/purchase-orders', { params }).then(r => r.data.data);
export const getPurchaseOrder = (id: number) =>
  api.get(`/purchase-orders/${id}`).then(r => r.data.data);
export const createPurchaseOrder = (body: Record<string, unknown>) =>
  api.post('/purchase-orders', body).then(r => r.data.data);
export const updatePurchaseOrder = (id: number, body: Record<string, unknown>) =>
  api.put(`/purchase-orders/${id}`, body).then(r => r.data.data);
export const getPurchaseOrderItems = (id: number) =>
  api.get(`/purchase-orders/${id}/items`).then(r => r.data.data);
export const addPurchaseOrderItem = (id: number, body: Record<string, unknown>) =>
  api.post(`/purchase-orders/${id}/items`, body).then(r => r.data.data);
export const updateOrderDetail = (id: number, body: Record<string, unknown>) =>
  api.put(`/order-details/${id}`, body).then(r => r.data.data);
export const deleteOrderDetail = (id: number) =>
  api.delete(`/order-details/${id}`).then(r => r.data.data);
