import api from './client';

export const getApplications = (params?: Record<string, string>) =>
  api.get('/applications', { params }).then(r => r.data.data);
export const createApplication = (body: Record<string, unknown>) =>
  api.post('/applications', body).then(r => r.data.data);
export const updateApplication = (id: number, body: Record<string, unknown>) =>
  api.put(`/applications/${id}`, body).then(r => r.data.data);
