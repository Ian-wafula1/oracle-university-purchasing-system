import api from './client';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; username: string; password: string; role: string; }
export interface AuthUser { user_id: number; username: string; role: string; name: string; }
export interface AuthResponse { token: string; user: AuthUser; }

const extractAuth = (data: any): AuthResponse => {
  const token = data.token;
  const user: AuthUser = data.user ?? {
    user_id: data.user_id,
    username: data.username,
    role: data.role,
    name: data.name,
  };
  return { token, user };
};

export const login = (body: LoginPayload): Promise<AuthResponse> =>
  api.post('/auth/login', body).then(r => extractAuth(r.data.data));

export const register = (body: RegisterPayload): Promise<AuthResponse> =>
  api.post('/auth/register', body).then(r => extractAuth(r.data.data));
