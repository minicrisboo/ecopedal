import { state } from '../data.js';

const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const statusLabel = { approved: 'Aprobada', pending: 'Pendiente', paused: 'Pausada', rejected: 'Rechazada' };

export function renderAdmin() {
  const completed = state.reservations.filter((reservation) => reservation.status === 'completed').length;
  const activeBikes = state.bikes.filter((bike) => bike.status === 'approved').length;
  const pendingBikes = state.bikes.filter((bike) => bike.status === 'pending').length;
  const revenue = state.reservations.filter((reservation) => reservation.status !== 'rejected').reduce((sum, reservation) => sum + reservation.total, 0);
  return `
    <section class="page-heading"><div><p class="eyebrow">Centro de operaciones</p><h1>Panel de administración</h1><p>Gestiona la comunidad, las publicaciones y las solicitudes.</p></div><button class="btn btn-quiet" data-action="refresh"><i data-lucide="rotate-cw"></i> Actualizar vista</button></section>
    <div class="stats-grid">
      ${stat('Usuarios registrados', state.users.length, 'Personas en la comunidad', 'users')}
      ${stat('Bicis publicadas', activeBikes, `${pendingBikes} pendientes de revisión`, 'bike')}
      ${stat('Reservas', state.reservations.length, `${completed} completadas`, 'calendar-check')}
      ${stat('Volumen reservado', money(revenue), 'MXN · antes de comisiones', 'wallet')}
    </div>
    <section><div class="section-title"><h2>Usuarios</h2><span>${state.users.length} cuentas</span></div>
      <div class="panel table-wrap"><table class="data-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      ${state.users.map((user) => `<tr><td><span class="cell-main">${escapeHtml(user.name)}</span></td><td>${escapeHtml(user.email)}</td><td><form id="admin-role-form" class="inline-form" data-user-id="${user.id}"><select class="filter-control role-control" name="role" aria-label="Rol de ${escapeHtml(user.name)}">${['renter', 'owner', 'editor', 'admin'].map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleName(role)}</option>`).join('')}</select></form></td><td><span class="status ${user.status === 'suspended' ? 'paused' : ''}">${user.status === 'suspended' ? 'Suspendida' : 'Activa'}</span></td><td><button class="btn ${user.status === 'suspended' ? 'btn-primary' : 'btn-danger'} btn-small" data-action="user-status" data-id="${user.id}" data-status="${user.status === 'suspended' ? 'active' : 'suspended'}">${user.status === 'suspended' ? 'Reactivar' : 'Suspender'}</button></td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section><div class="section-title"><h2>Moderación de bicicletas</h2><span>${pendingBikes} por revisar</span></div>
      <div class="panel table-wrap"><table class="data-table"><thead><tr><th>Bicicleta</th><th>Propietario</th><th>Precio/h</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      ${state.bikes.map((bike) => `<tr><td><span class="cell-main">${escapeHtml(bike.name)}</span><span class="cell-sub">${escapeHtml(bike.type)} · ${escapeHtml(bike.location)}</span></td><td>${escapeHtml(bike.ownerName ?? 'Usuario')}</td><td>${money(bike.price)}</td><td><span class="status ${bike.status}">${statusLabel[bike.status] ?? bike.status}</span></td><td>${bike.status === 'pending' ? `<button class="btn btn-primary btn-small" data-action="moderate" data-id="${bike.id}" data-status="approved">Aprobar</button> <button class="btn btn-danger btn-small" data-action="moderate" data-id="${bike.id}" data-status="rejected">Rechazar</button>` : `<button class="btn btn-quiet btn-small" data-action="moderate" data-id="${bike.id}" data-status="${bike.status === 'paused' ? 'approved' : 'paused'}">${bike.status === 'paused' ? 'Reactivar' : 'Pausar'}</button>`}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
}

function stat(label, value, foot, icon) { return `<article class="stat-card"><span class="stat-label">${label}</span><div class="stat-value">${value}</div><div class="stat-foot"><i data-lucide="${icon}" style="width:13px;vertical-align:-2px"></i> ${foot}</div></article>`; }
function roleName(role) { return ({ admin: 'Administrador', editor: 'Editor', owner: 'Propietario', renter: 'Cliente' })[role] ?? role; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
