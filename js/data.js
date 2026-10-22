import { api } from './api.js';

export const state = { bikes: [], reservations: [], users: [], content: { banner: { title: '', text: '' }, blogs: [], faqs: [] } };

export async function loadData(role) {
  const requests = [api('/bikes'), api('/reservations'), api('/content')];
  if (role === 'admin') requests.push(api('/admin/users'));
  const [bikesResult, reservationResult, contentResult, usersResult] = await Promise.all(requests);
  state.bikes = bikesResult.bikes;
  state.reservations = reservationResult.reservations;
  state.content = { ...state.content, ...contentResult.content };
  state.users = usersResult?.users ?? [];
  return state;
}

export function getBike(bikeId) {
  return state.bikes.find((bike) => bike.id === bikeId);
}
