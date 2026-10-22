import { state } from '../data.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

export function renderRenter(filters = {}) {
  const bikes = state.bikes.filter((bike) => bike.status === 'approved').filter((bike) => {
    const query = (filters.query ?? '').trim().toLowerCase();
    return (!query || `${bike.name} ${bike.location} ${bike.type}`.toLowerCase().includes(query))
      && (!filters.type || bike.type === filters.type)
      && (!filters.maxPrice || bike.price <= Number(filters.maxPrice));
  });
  const banner = state.content.banner;
  return `
    <section class="hero"><img class="hero-photo" src="https://images.unsplash.com/photo-1471506480208-91b3a4cc78be?auto=format&fit=crop&w=1800&q=90" alt="Ciclista recorriendo una ruta arbolada" /><div class="hero-shade"></div><div class="hero-copy"><p class="eyebrow">Renta local, rueda libre</p><h1>${escapeHtml(banner.title)}</h1><p>${escapeHtml(banner.text)}</p><a class="btn btn-lime" href="#catalogo">Encuentra tu bici <i data-lucide="arrow-down-right"></i></a></div></section>
    <section id="catalogo"><div class="page-heading"><div><p class="eyebrow">Catálogo de la comunidad</p><h1>Una bici para cada plan</h1><p>Explora opciones cerca de ti y reserva directamente con su anfitrión.</p></div><span class="status">${bikes.length} disponibles</span></div>
      <form id="filter-form" class="filter-bar">
        <label class="filter-search"><span class="sr-only">Buscar por nombre o ubicación</span><i data-lucide="search"></i><input class="filter-control" name="query" value="${escapeHtml(filters.query ?? '')}" placeholder="Nombre, zona o colonia" /></label>
        <label><span class="sr-only">Filtrar por tipo</span><select class="filter-control" name="type"><option value="">Todos los tipos</option>${['Urbana', 'Montaña', 'Carretera', 'Eléctrica', 'Plegable'].map((type) => `<option ${filters.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
        <label><span class="sr-only">Precio máximo por hora</span><select class="filter-control" name="maxPrice"><option value="">Cualquier precio</option>${[[50, 'Hasta $50'], [75, 'Hasta $75'], [100, 'Hasta $100']].map(([amount, label]) => `<option value="${amount}" ${String(filters.maxPrice ?? '') === String(amount) ? 'selected' : ''}>${label} / hora</option>`).join('')}</select></label>
        <button type="submit" class="btn btn-primary"><i data-lucide="sliders-horizontal"></i> Filtrar</button>
      </form>
      <div class="bike-grid">${bikes.map((bike) => renderBike(bike)).join('') || `<div class="empty-state"><i data-lucide="bike"></i><h3>No encontramos bicis con esos filtros</h3><p>Prueba con otra zona, tipo o rango de precio.</p></div>`}</div>
    </section>`;
}

function renderBike(bike) {
  return `<article class="bike-card"><div class="bike-image-wrap"><img class="bike-image" src="${escapeHtml(bike.image)}" alt="${escapeHtml(bike.name)}" loading="lazy" /><span class="bike-tag">${escapeHtml(bike.type)}</span></div><div class="bike-content"><div class="bike-title-row"><h2 class="bike-title">${escapeHtml(bike.name)}</h2><span class="rating">★ ${bike.rating ? Number(bike.rating).toFixed(1) : 'Nueva'}</span></div><div class="bike-meta"><i data-lucide="map-pin"></i>${escapeHtml(bike.location)} · ${escapeHtml(bike.ownerName ?? 'Anfitrión')}</div><div class="bike-bottom"><span class="price">${money(bike.price)} <small>/ hora</small></span><button class="btn btn-primary btn-small" data-action="open-booking" data-id="${bike.id}">Reservar <i data-lucide="arrow-up-right"></i></button></div></div></article>`;
}
