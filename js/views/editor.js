import { state } from '../data.js';

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }

export function renderEditor() {
  const { banner, blogs, faqs } = state.content;
  return `
    <section class="page-heading"><div><p class="eyebrow">Contenido de la plataforma</p><h1>Estudio editorial</h1><p>Actualiza los mensajes que acompañan a cada ciclista.</p></div><span class="status">Cambios guardados localmente</span></section>
    <div class="split-layout">
      <section class="panel form-panel"><h2>Banner principal</h2><p class="form-note">Este mensaje aparece al inicio del catálogo.</p>
        <form id="banner-form" class="form-grid">
          <div class="field full"><label for="banner-title">Título</label><input id="banner-title" name="title" maxlength="70" value="${escapeHtml(banner.title)}" required /></div>
          <div class="field full"><label for="banner-text">Texto de apoyo</label><textarea id="banner-text" name="text" maxlength="180" required>${escapeHtml(banner.text)}</textarea></div>
          <div class="field full"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i> Guardar banner</button></div>
        </form>
        <div class="section-title"><h2>Vista previa</h2></div><div class="banner-preview"><div><strong id="banner-preview-title">${escapeHtml(banner.title)}</strong><p id="banner-preview-text">${escapeHtml(banner.text)}</p></div><i data-lucide="megaphone"></i></div>
      </section>
      <section class="panel form-panel"><h2>Preguntas frecuentes</h2><p class="form-note">Respuestas breves para dudas comunes de la comunidad.</p>
        <div class="content-list">${faqs.map((faq) => `<article class="content-row"><div><h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p></div><button class="icon-button" data-action="delete-faq" data-id="${faq.id}" title="Eliminar pregunta" aria-label="Eliminar ${escapeHtml(faq.question)}"><i data-lucide="trash-2"></i></button></article>`).join('') || '<p class="form-note">Todavía no hay preguntas. Agrega una nueva abajo.</p>'}</div>
        <form id="faq-form" class="form-grid" style="margin-top:16px">
          <div class="field full"><label for="faq-question">Nueva pregunta</label><input id="faq-question" name="question" maxlength="100" required /></div>
          <div class="field full"><label for="faq-answer">Respuesta</label><textarea id="faq-answer" name="answer" maxlength="280" required></textarea></div>
          <div class="field full"><button class="btn btn-primary" type="submit"><i data-lucide="plus"></i> Agregar pregunta</button></div>
        </form>
      </section>
    </div>
    <section class="panel form-panel" style="margin-top:20px"><div class="section-title" style="margin-top:0"><div><h2>Artículos del blog</h2><span>Historias y consejos para la comunidad</span></div></div>
      <div class="content-list">${blogs.map((blog) => `<article class="content-row"><div><h3>${escapeHtml(blog.title)} <span class="status ${blog.status === 'Borrador' ? 'pending' : ''}">${escapeHtml(blog.status)}</span></h3><p>${escapeHtml(blog.summary)}</p></div><button class="icon-button" data-action="delete-blog" data-id="${blog.id}" title="Eliminar artículo" aria-label="Eliminar ${escapeHtml(blog.title)}"><i data-lucide="trash-2"></i></button></article>`).join('') || '<p class="form-note">Todavía no hay artículos. Agrega uno abajo.</p>'}</div>
      <form id="blog-form" class="form-grid" style="margin-top:16px"><div class="field"><label for="blog-title">Título</label><input id="blog-title" name="title" maxlength="100" required /></div><div class="field"><label for="blog-status">Estado</label><select id="blog-status" name="status"><option>Publicado</option><option>Borrador</option></select></div><div class="field full"><label for="blog-summary">Resumen</label><textarea id="blog-summary" name="summary" maxlength="280" required></textarea></div><div class="field full"><button class="btn btn-primary" type="submit"><i data-lucide="plus"></i> Agregar artículo</button></div></form>
    </section>`;
}
