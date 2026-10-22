import { api } from './api.js?v=3';

export const roleLabels = { admin: 'Administrador', editor: 'Editor', owner: 'Propietario', renter: 'Cliente' };

export async function getCurrentUser() {
  try {
    const result = await api('/auth/me');
    return result.user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function signIn(email, password) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } });
  return result.user;
}

export async function signUp({ name, email, password, accountType }) {
  const result = await api('/auth/register', { method: 'POST', body: { name, email, password, accountType } });
  return result.user;
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' });
}
