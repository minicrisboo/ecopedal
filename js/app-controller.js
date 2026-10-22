import { api } from './api.js?v=3';
import { getCurrentUser, signIn, signOut, signUp, roleLabels } from './auth.js?v=3';
import { state, loadData, getBike } from './data.js';
import { renderAdmin } from './views/admin.js';
import { renderEditor } from './views/editor.js';
import { renderOwner } from './views/owner.js';
import { renderRenter } from './views/renter.js';

const app = document.querySelector('#app');
const splash = document.querySelector('#splash-screen');
const shell = document.querySelector('#site-shell');
const mainNav = document.querySelector('#main-nav');
const accountMenu = document.querySelector('#account-menu');
let currentUser = null;
let renterFilters = {};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function toast(message, isError = false) {
  const region = document.querySelector('#toast-region');
  const node = document.createElement('div');
  node.className = `toast${isError ? ' error' : ''}`;
  node.textContent = message;
  region.append(node);
  window.setTimeout(() => node.remove(), 3600);
}

function renderAuth(mode = 'login', notice = '') {
  const registering = mode === 'register';
  mainNav.replaceChildren();
  accountMenu.replaceChildren();
  app.innerHTML = `
    <section class="auth-layout">
      <div class="auth-story">
        <p class="eyebrow">Movilidad compartida, impacto positivo</p>
        <h1>Una ciudad más libre empieza sobre dos ruedas.</h1>
        <p>Descubre bicicletas cerca de ti o comparte la tuya con tu comunidad.</p>
        <div class="auth-story-mark"><i data-lucide="bike"></i><span>Muévete con propósito.</span></div>
      </div>
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-tabs" role="tablist" aria-label="Acceso a Ecopedal">
          <button type="button" role="tab" aria-selected="${!registering}" class="auth-tab ${!registering ? 'active' : ''}" data-action="auth-mode" data-mode="login">Iniciar sesión</button>
          <button type="button" role="tab" aria-selected="${registering}" class="auth-tab ${registering ? 'active' : ''}" data-action="auth-mode" data-mode="register">Crear cuenta</button>
        </div>
        <p class="eyebrow">${registering ? 'Únete a la comunidad' : 'Bienvenido de vuelta'}</p>
        <h2 id="auth-title">${registering ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
        <p class="auth-description">${registering ? 'Elige cómo quieres empezar en Ecopedal.' : 'Accede a tus reservas y a tu espacio Ecopedal.'}</p>
        ${notice ? `<p class="auth-notice" role="status">${escapeHtml(notice)}</p>` : ''}
        <p id="auth-error" class="auth-error" role="alert" hidden></p>
        <form id="auth-form" data-mode="${mode}" class="auth-form">
          ${registering ? '<label class="field"><span>Nombre completo</span><input name="name" autocomplete="name" minlength="2" maxlength="100" required /></label>' : ''}
          <label class="field"><span>Correo electrónico</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
          <label class="field"><span>Contraseña</span><input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? '10' : '1'}" maxlength="72" required />${registering ? '<small>Usa al menos 10 caracteres.</small>' : ''}</label>
          ${registering ? '<label class="field"><span>Tipo de cuenta</span><select name="accountType"><option value="renter">Cliente: rentar bicicletas</option><option value="owner">Propietario: publicar mi bicicleta</option></select></label>' : ''}
          <button class="btn btn-primary auth-submit" type="submit">${registering ? 'Crear cuenta' : 'Entrar'} <i data-lucide="arrow-right"></i></button>
        </form>
        <p class="auth-switch">${registering ? '¿Ya tienes cuenta?' : '¿Primera vez en Ecopedal?'} <button type="button" data-action="auth-mode" data-mode="${registering ? 'login' : 'register'}">${registering ? 'Inicia sesión' : 'Crea una cuenta'}</button></p>
      </section>
    </section>`;
  renderIcons();
}

function renderNavigation() {
  const viewName = { renter: 'Explorar bicicletas', owner: 'Panel de propietario', editor: 'Gestión de contenido', admin: 'Administración' }[currentUser.role] ?? 'Ecopedal';
  mainNav.innerHTML = `<span class="nav-current"><i data-lucide="layout-dashboard"></i>${viewName}</span>`;
  accountMenu.innerHTML = `<div class="account-identity"><span class="account-name">${escapeHtml(currentUser.name)}</span><span class="account-role">${escapeHtml(roleLabels[currentUser.role] ?? '')}</span></div><button class="btn btn-quiet btn-small" type="button" data-action="logout"><i data-lucide="log-out"></i><span class="logout-label">Cerrar sesión</span></button>`;
}

async function renderDashboard() {
  renderNavigation();
  app.innerHTML = '<div class="loading-state"><span class="loading-spinner"></span><p>Cargando tu espacio...</p></div>';
  try {
    await loadData(currentUser.role);
    state.currentUser = currentUser;
    const views = { admin: renderAdmin, editor: renderEditor, owner: renderOwner, renter: () => renderRenter(renterFilters) };
    app.innerHTML = (views[currentUser.role] ?? views.renter)();
    renderIcons();
  } catch (error) {
    app.innerHTML = `<section class="empty-state dashboard-error"><i data-lucide="cloud-off"></i><h3>No pudimos cargar Ecopedal</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-primary" data-action="retry-dashboard">Reintentar</button></section>`;
    renderIcons();
  }
}

function openBookingModal(bikeId) {
  const bike = getBike(bikeId);
  if (!bike) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);
  const price = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(bike.price);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" data-modal-content>
      <div class="modal-head"><div><p class="eyebrow">Solicitud de renta</p><h2 id="booking-title">${escapeHtml(bike.name)}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Cerrar"><i data-lucide="x"></i></button></div>
      <p class="modal-copy">${escapeHtml(bike.location)} · ${price} por hora</p>
      <form id="booking-form" data-bike-id="${escapeHtml(bike.id)}">
        <div class="form-grid"><label class="field"><span>Día de inicio</span><input name="date" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${date}" required /></label><label class="field"><span>Horas de renta</span><input name="hours" type="number" min="1" max="24" value="2" required /></label></div>
        <div class="cost-box"><span>Costo total estimado</span><strong id="booking-total">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(bike.price * 2)}</strong></div>
        <p class="form-note">El anfitrión confirmará la solicitud. Esta versión no procesa pagos.</p>
        <div class="modal-actions"><button class="btn btn-quiet" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Enviar solicitud</button></div>
      </form>
    </section></div>`);
  renderIcons();
}

async function handleSubmit(form) {
  const values = Object.fromEntries(new FormData(form));
  if (form.id === 'auth-form') {
    const errorBox = document.querySelector('#auth-error');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      currentUser = form.dataset.mode === 'register' ? await signUp(values) : await signIn(values.email, values.password);
      await renderDashboard();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
    return;
  }
  if (form.id === 'filter-form') {
    renterFilters = values;
    app.innerHTML = renderRenter(renterFilters);
    renderIcons();
    return;
  }
  if (form.id === 'bike-form') {
    await api('/bikes', { method: 'POST', body: { ...values, price: Number(values.price) } });
    await renderDashboard();
    toast('Bicicleta enviada a revisión.');
    return;
  }
  if (form.id === 'booking-form') {
    await api('/reservations', { method: 'POST', body: { bikeId: form.dataset.bikeId, date: values.date, hours: Number(values.hours) } });
    document.querySelector('.modal-backdrop')?.remove();
    await renderDashboard();
    toast('Solicitud enviada al propietario.');
    return;
  }
  if (form.id === 'banner-form') {
    await api('/content/banner', { method: 'PUT', body: { value: { title: values.title.trim(), text: values.text.trim() } } });
    await renderDashboard();
    toast('Banner actualizado.');
    return;
  }
  if (form.id === 'faq-form' || form.id === 'blog-form') {
    const key = form.id === 'faq-form' ? 'faqs' : 'blogs';
    const item = key === 'faqs'
      ? { id: crypto.randomUUID(), question: values.question.trim(), answer: values.answer.trim() }
      : { id: crypto.randomUUID(), title: values.title.trim(), summary: values.summary.trim(), status: values.status };
    await api(`/content/${key}`, { method: 'PUT', body: { value: [...state.content[key], item] } });
    await renderDashboard();
    toast(key === 'faqs' ? 'Pregunta agregada.' : 'Artículo agregado.');
  }
}

document.addEventListener('submit', async (event) => {
  if (!(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  try {
    await handleSubmit(event.target);
  } catch (error) {
    if (event.target.id === 'auth-form') {
      const box = document.querySelector('#auth-error');
      box.textContent = error.message;
      box.hidden = false;
    } else toast(error.message, true);
  }
});

document.addEventListener('change', async (event) => {
  if (!event.target.matches('.role-control')) return;
  try {
    await api(`/admin/users/${event.target.dataset.userId}`, { method: 'PATCH', body: { role: event.target.value } });
    toast('Rol actualizado.');
    await renderDashboard();
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'banner-title') document.querySelector('#banner-preview-title').textContent = event.target.value;
  if (event.target.id === 'banner-text') document.querySelector('#banner-preview-text').textContent = event.target.value;
  if (event.target.name === 'hours' && event.target.closest('#booking-form')) {
    const bike = getBike(event.target.closest('form').dataset.bikeId);
    const hours = Math.max(1, Math.min(24, Number(event.target.value) || 1));
    document.querySelector('#booking-total').textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((bike?.price ?? 0) * hours);
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, status, mode } = button.dataset;
  try {
    if (action === 'auth-mode') return renderAuth(mode);
    if (action === 'open-booking') return openBookingModal(id);
    if (action === 'close-modal') {
      if (button.matches('button') || (button.classList.contains('modal-backdrop') && event.target === button)) document.querySelector('.modal-backdrop')?.remove();
      return;
    }
    if (action === 'logout') {
      await signOut();
      currentUser = null;
      renderAuth('login', 'Has cerrado sesión.');
      return;
    }
    if (action === 'retry-dashboard') return renderDashboard();
    if (action === 'moderate') {
      await api(`/bikes/${id}/status`, { method: 'PATCH', body: { status } });
      await renderDashboard();
      toast(status === 'approved' ? 'Bicicleta aprobada.' : 'Estado de publicación actualizado.');
      return;
    }
    if (action === 'reservation-status') {
      await api(`/reservations/${id}/status`, { method: 'PATCH', body: { status } });
      await renderDashboard();
      toast(status === 'confirmed' ? 'Reserva aceptada.' : 'Solicitud rechazada.');
      return;
    }
    if (action === 'user-status') {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: { status } });
      await renderDashboard();
      toast(status === 'suspended' ? 'Cuenta suspendida.' : 'Cuenta reactivada.');
      return;
    }
    if (action === 'delete-faq' || action === 'delete-blog') {
      const key = action === 'delete-faq' ? 'faqs' : 'blogs';
      const value = state.content[key].filter((item) => item.id !== id);
      await api(`/content/${key}`, { method: 'PUT', body: { value } });
      await renderDashboard();
      toast(action === 'delete-faq' ? 'Pregunta eliminada.' : 'Artículo eliminado.');
      return;
    }
    if (action === 'refresh') await renderDashboard();
  } catch (error) { toast(error.message, true); }
});

async function start() {
  const minimumSplash = new Promise((resolve) => window.setTimeout(resolve, 900));
  let notice = '';
  try { currentUser = await getCurrentUser(); }
  catch { notice = 'La API no está configurada. Define ECOPEDAL_API_URL en GitHub Actions después de desplegar el backend.'; }
  await minimumSplash;
  splash.classList.add('splash-hidden');
  shell.classList.remove('is-hidden');
  document.querySelector('#footer-year').textContent = `© ${new Date().getFullYear()}`;
  if (currentUser) await renderDashboard();
  else renderAuth('login', notice);
  renderIcons();
}

start();
