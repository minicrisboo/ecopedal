import { state } from '../data.js';

const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const reservationLabel = { pending: 'Pendiente', confirmed: 'Aceptada', rejected: 'Rechazada', completed: 'Completada' };

export function renderOwner() {
  const ownerId = state.currentUser?.id;
  const bikes = state.bikes.filter((bike) => bike.ownerId === ownerId);
  const reservations = state.reservations.filter((reservation) => reservation.ownerId === ownerId);
  const earnings = reservations.filter((reservation) => reservation.status === 'completed').reduce((sum, item) => sum + item.total, 0);
  return `
    <section class="page-heading"><div><p class="eyebrow">Tu espacio de anfitrión</p><h1>Hola, ${escapeHtml(state.currentUser?.name ?? 'anfitrión')}.</h1><p>Administra tus bicicletas y responde a las solicitudes de renta.</p></div><span class="status">Cuenta activa</span></section>
    <div class="stats-grid">
      ${stat('Mis bicicletas', bikes.length, `${bikes.filter((bike) => bike.status === 'approved').length} visibles en catálogo`, 'bike')}
      ${stat('Solicitudes', reservations.filter((item) => item.status === 'pending').length, 'Esperando tu respuesta', 'bell-ring')}
      ${stat('Reservas aceptadas', reservations.filter((item) => item.status === 'confirmed').length, 'Próximos alquileres', 'calendar-check')}
      ${stat('Ingresos completados', money(earnings), 'MXN · este periodo', 'wallet')}
    </div>
    <div class="split-layout">
      <section class="panel form-panel"><h2>Publica una bicicleta</h2><p class="form-note">Las publicaciones nuevas se revisan antes de aparecer en el catálogo.</p>
        <form id="bike-form" class="form-grid">
          <div class="field full"><label for="bike-name">Nombre de la bicicleta</label><input id="bike-name" name="name" maxlength="50" placeholder="Ej. Paseo de domingo" required /></div>
          <div class="field"><label for="bike-type">Tipo</label><select id="bike-type" name="type" required><option value="">Selecciona</option><option>Urbana</option><option>Montaña</option><option>Carretera</option><option>Eléctrica</option><option>Plegable</option></select></div>
          <div class="field"><label for="bike-price">Precio por hora (MXN)</label><input id="bike-price" name="price" type="number" min="1" max="10000" step="1" required /></div>
          <div class="field full"><label for="bike-location">Ubicación</label><input id="bike-location" name="location" maxlength="80" placeholder="Colonia, ciudad" required /></div>
          <div class="field full"><label for="bike-image">URL de fotografía</label><input id="bike-image" name="image" type="url" placeholder="https://..." required /></div>
          <div class="field full"><button class="btn btn-primary" type="submit"><i data-lucide="plus"></i> Enviar a revisión</button></div>
        </form>
      </section>
      <div>
        <section><div class="section-title"><h2>Mis bicicletas</h2><span>${bikes.length} publicaciones</span></div><div class="panel table-wrap"><table class="data-table"><thead><tr><th>Bicicleta</th><th>Precio/h</th><th>Estado</th></tr></thead><tbody>
          ${bikes.map((bike) => `<tr><td><div class="owner-bike-cell"><img class="mini-bike" src="${escapeHtml(bike.image)}" alt="" /><span><span class="cell-main">${escapeHtml(bike.name)}</span><span class="cell-sub">${escapeHtml(bike.type)}</span></span></div></td><td>${money(bike.price)}</td><td><span class="status ${bike.status}">${bike.status === 'approved' ? 'Publicada' : bike.status === 'pending' ? 'En revisión' : bike.status === 'paused' ? 'Pausada' : 'Rechazada'}</span></td></tr>`).join('') || '<tr><td colspan="3">Todavía no has publicado bicicletas.</td></tr>'}
        </tbody></table></div></section>
        <section><div class="section-title"><h2>Solicitudes de reserva</h2><span>${reservations.length} solicitudes</span></div><div class="panel table-wrap"><table class="data-table"><thead><tr><th>Cliente / bici</th><th>Fecha</th><th>Total</th><th>Estado y acciones</th></tr></thead><tbody>
          ${reservations.map((reservation) => { const bike = state.bikes.find((item) => item.id === reservation.bikeId); return `<tr><td><span class="cell-main">${escapeHtml(reservation.renterName)}</span><span class="cell-sub">${escapeHtml(bike?.name ?? 'Bicicleta')} · ${reservation.hours} h</span></td><td>${formatDate(reservation.date)}</td><td>${money(reservation.total)}</td><td><span class="status ${reservation.status}">${reservationLabel[reservation.status] ?? reservation.status}</span>${reservation.status === 'pending' ? `<div style="margin-top:7px"><button class="btn btn-primary btn-small" data-action="reservation-status" data-id="${reservation.id}" data-status="confirmed">Aceptar</button> <button class="btn btn-danger btn-small" data-action="reservation-status" data-id="${reservation.id}" data-status="rejected">Rechazar</button></div>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="4">Aún no tienes solicitudes.</td></tr>'}
        </tbody></table></div></section>
      </div>
    </div>`;
}

function stat(label, value, foot, icon) { return `<article class="stat-card"><span class="stat-label">${label}</span><div class="stat-value">${value}</div><div class="stat-foot"><i data-lucide="${icon}" style="width:13px;vertical-align:-2px"></i> ${foot}</div></article>`; }
function formatDate(value) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
