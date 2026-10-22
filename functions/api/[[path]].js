const SESSION_COOKIE = 'ecopedal_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const PASSWORD_ITERATIONS = 310000;
const SIGNUP_ROLES = new Set(['renter', 'owner']);
const BIKE_TYPES = new Set(['Urbana', 'Montaña', 'Carretera', 'Eléctrica', 'Plegable']);

const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
});

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(new Uint8Array(result))}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, iterations, encodedSalt, encodedHash] = String(stored).split('$');
  if (algorithm !== 'pbkdf2' || !encodedSalt || !encodedHash) return false;
  const actualHash = (await passwordHash(password, fromBase64(encodedSalt), Number(iterations))).split('$')[3];
  const actual = fromBase64(actualHash);
  const expected = fromBase64(encodedHash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

async function sha256(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const prefix = `${name}=`;
  const pair = (request.headers.get('Cookie') ?? '').split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : null;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

async function ensureAdmin(db, env) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !env.ADMIN_PASSWORD) return;
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return;
  await db.prepare(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role)
    VALUES (?, 'Administración Ecopedal', ?, ?, 'admin')`)
    .bind(crypto.randomUUID(), email, await passwordHash(env.ADMIN_PASSWORD)).run();
}

async function getCurrentUser(request, db) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.name, users.email, users.role, users.status
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .bind(await sha256(token), new Date().toISOString()).first();
}

async function createSession(db, userId) {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expiresAt).run();
  return token;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function validImageUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validContent(key, value) {
  if (key === 'banner') return value && typeof value.title === 'string' && value.title.length <= 100 && typeof value.text === 'string' && value.text.length <= 240;
  if (key === 'blogs') return Array.isArray(value) && value.length <= 200 && value.every((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.summary === 'string' && ['Publicado', 'Borrador'].includes(item.status));
  if (key === 'faqs') return Array.isArray(value) && value.length <= 200 && value.every((item) => item && typeof item.id === 'string' && typeof item.question === 'string' && typeof item.answer === 'string');
  return false;
}

async function authRoute(request, env, url) {
  const db = env.DB;
  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await getCurrentUser(request, db);
    return user?.status === 'active' ? json({ user }) : json({ error: 'Inicia sesión para continuar.' }, 401);
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = getCookie(request, SESSION_COOKIE);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return new Response(null, { status: 204, headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } });
  }

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return json({ error: 'El cuerpo JSON no es válido.' }, 400);
    const { name, email, password, accountType = 'renter' } = body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return json({ error: 'Escribe un nombre de entre 2 y 100 caracteres.' }, 400);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Escribe un correo válido.' }, 400);
    if (typeof password !== 'string' || password.length < 10 || password.length > 72) return json({ error: 'La contraseña debe tener entre 10 y 72 caracteres.' }, 400);
    if (!SIGNUP_ROLES.has(accountType)) return json({ error: 'El tipo de cuenta no es válido.' }, 400);
    const id = crypto.randomUUID();
    try {
      await db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .bind(id, name.trim(), email.trim().toLowerCase(), await passwordHash(password), accountType).run();
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return json({ error: 'Ya existe una cuenta con ese correo.' }, 409);
      throw error;
    }
    const user = await db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').bind(id).first();
    return json({ user }, 201, { 'Set-Cookie': sessionCookie(await createSession(db, id)) });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') return json({ error: 'Escribe tu correo y contraseña.' }, 400);
    const user = await db.prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE email = ?')
      .bind(body.email.trim().toLowerCase()).first();
    if (!user || !(await verifyPassword(body.password, user.password_hash))) return json({ error: 'Correo o contraseña incorrectos.' }, 401);
    if (user.status !== 'active') return json({ error: 'Esta cuenta está suspendida.' }, 403);
    const { password_hash: _passwordHash, ...publicUser } = user;
    return json({ user: publicUser }, 200, { 'Set-Cookie': sessionCookie(await createSession(db, user.id)) });
  }

  return json({ error: 'Ruta de autenticación no encontrada.' }, 404);
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (!env.DB) return json({ error: 'El binding D1 DB no está configurado.' }, 503);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Origen de solicitud no permitido.' }, 403);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.get('X-Ecopedal-Client') !== 'web') return json({ error: 'Solicitud de navegador no válida.' }, 403);

  try {
    await ensureAdmin(env.DB, env);
    if (pathname.startsWith('/api/auth/')) return await authRoute(request, env, new URL(request.url));
    const user = await getCurrentUser(request, env.DB);
    if (!user || user.status !== 'active') return json({ error: 'Inicia sesión para continuar.' }, 401);

    if (pathname === '/api/bikes' && request.method === 'GET') {
      const query = `SELECT b.id, b.owner_id AS ownerId, b.name, b.type, b.price_per_hour AS price,
        b.location, b.image_url AS image, b.status, b.rating, u.name AS ownerName
        FROM bikes b JOIN users u ON u.id = b.owner_id`;
      let statement;
      if (user.role === 'admin') statement = env.DB.prepare(`${query} ORDER BY b.created_at DESC`);
      else if (user.role === 'owner') statement = env.DB.prepare(`${query} WHERE b.owner_id = ? ORDER BY b.created_at DESC`).bind(user.id);
      else statement = env.DB.prepare(`${query} WHERE b.status = 'approved' ORDER BY b.created_at DESC`);
      return json({ bikes: (await statement.all()).results });
    }

    if (pathname === '/api/bikes' && request.method === 'POST') {
      if (user.role !== 'owner') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80
        || !BIKE_TYPES.has(body.type) || !Number.isInteger(Number(body.price)) || Number(body.price) < 1 || Number(body.price) > 10000
        || typeof body.location !== 'string' || body.location.trim().length < 2 || body.location.length > 120
        || typeof body.image !== 'string' || !validImageUrl(body.image)) return json({ error: 'Revisa el nombre, tipo, precio, ubicación y URL de la foto.' }, 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO bikes (id, owner_id, name, type, price_per_hour, location, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, user.id, body.name.trim(), body.type, Number(body.price), body.location.trim(), body.image.trim()).run();
      const bike = await env.DB.prepare(`SELECT id, owner_id AS ownerId, name, type, price_per_hour AS price, location, image_url AS image, status, rating, ? AS ownerName FROM bikes WHERE id = ?`)
        .bind(user.name, id).first();
      return json({ bike }, 201);
    }

    const bikeStatus = pathname.match(/^\/api\/bikes\/([^/]+)\/status$/);
    if (bikeStatus && request.method === 'PATCH') {
      if (user.role !== 'admin') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      if (!['approved', 'paused', 'rejected'].includes(body?.status)) return json({ error: 'Estado de bicicleta no válido.' }, 400);
      const result = await env.DB.prepare('UPDATE bikes SET status = ? WHERE id = ?').bind(body.status, bikeStatus[1]).run();
      return result.meta.changes ? json({ bike: { id: bikeStatus[1], status: body.status } }) : json({ error: 'No encontramos esa bicicleta.' }, 404);
    }

    if (pathname === '/api/reservations' && request.method === 'GET') {
      const base = `SELECT r.id, r.bike_id AS bikeId, r.owner_id AS ownerId, r.renter_id AS renterId,
        r.start_date AS date, r.hours, r.total, r.status, b.name AS bikeName, renter.name AS renterName
        FROM reservations r JOIN bikes b ON b.id = r.bike_id JOIN users renter ON renter.id = r.renter_id`;
      let statement;
      if (user.role === 'owner') statement = env.DB.prepare(`${base} WHERE r.owner_id = ? ORDER BY r.created_at DESC`).bind(user.id);
      else if (user.role === 'renter') statement = env.DB.prepare(`${base} WHERE r.renter_id = ? ORDER BY r.created_at DESC`).bind(user.id);
      else statement = env.DB.prepare(`${base} ORDER BY r.created_at DESC`);
      return json({ reservations: (await statement.all()).results });
    }

    if (pathname === '/api/reservations' && request.method === 'POST') {
      if (user.role !== 'renter') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      if (!body || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
        || !Number.isInteger(Number(body.hours)) || Number(body.hours) < 1 || Number(body.hours) > 24
        || body.date < new Date().toISOString().slice(0, 10)) return json({ error: 'La fecha o la duración de la reserva no son válidas.' }, 400);
      const reservation = await env.DB.prepare(`INSERT INTO reservations (id, bike_id, owner_id, renter_id, start_date, hours, total)
        SELECT ?, id, owner_id, ?, ?, ?, price_per_hour * ? FROM bikes
        WHERE id = ? AND status = 'approved' AND owner_id != ?
        RETURNING id, bike_id AS bikeId, owner_id AS ownerId, renter_id AS renterId, start_date AS date, hours, total, status`)
        .bind(crypto.randomUUID(), user.id, body.date, Number(body.hours), Number(body.hours), body.bikeId, user.id).first();
      return reservation ? json({ reservation }, 201) : json({ error: 'La bicicleta no está disponible para reservar.' }, 404);
    }

    const reservationStatus = pathname.match(/^\/api\/reservations\/([^/]+)\/status$/);
    if (reservationStatus && request.method === 'PATCH') {
      if (user.role !== 'owner') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      if (!['confirmed', 'rejected'].includes(body?.status)) return json({ error: 'Estado de reserva no válido.' }, 400);
      const result = await env.DB.prepare(`UPDATE reservations SET status = ? WHERE id = ? AND owner_id = ? AND status = 'pending'`)
        .bind(body.status, reservationStatus[1], user.id).run();
      return result.meta.changes ? json({ reservation: { id: reservationStatus[1], status: body.status } }) : json({ error: 'La solicitud ya no está pendiente o no te pertenece.' }, 404);
    }

    if (pathname === '/api/admin/users' && request.method === 'GET') {
      if (user.role !== 'admin') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      return json({ users: (await env.DB.prepare('SELECT id, name, email, role, status, created_at AS createdAt FROM users ORDER BY created_at DESC').all()).results });
    }

    const adminUser = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUser && request.method === 'PATCH') {
      if (user.role !== 'admin') return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      const roles = ['admin', 'editor', 'owner', 'renter'];
      const statuses = ['active', 'suspended'];
      if (!body || (body.role !== undefined && !roles.includes(body.role)) || (body.status !== undefined && !statuses.includes(body.status))) return json({ error: 'Rol o estado no válido.' }, 400);
      if (adminUser[1] === user.id && ((body.role !== undefined && body.role !== 'admin') || body.status === 'suspended')) return json({ error: 'No puedes quitarte tu propio acceso de administrador.' }, 400);
      const current = await env.DB.prepare('SELECT role, status FROM users WHERE id = ?').bind(adminUser[1]).first();
      if (!current) return json({ error: 'No encontramos esa cuenta.' }, 404);
      await env.DB.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').bind(body.role ?? current.role, body.status ?? current.status, adminUser[1]).run();
      return json({ user: await env.DB.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').bind(adminUser[1]).first() });
    }

    if (pathname === '/api/content' && request.method === 'GET') {
      const rows = (await env.DB.prepare("SELECT key, value FROM site_content WHERE key IN ('banner', 'blogs', 'faqs')").all()).results;
      const content = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
      content.blogs = (content.blogs ?? []).filter((blog) => blog.status === 'Publicado');
      return json({ content });
    }

    const contentRoute = pathname.match(/^\/api\/content\/([^/]+)$/);
    if (contentRoute && request.method === 'PUT') {
      if (!['editor', 'admin'].includes(user.role)) return json({ error: 'No tienes permisos para realizar esta acción.' }, 403);
      const body = await readJson(request);
      const key = contentRoute[1];
      if (!body || !validContent(key, body.value)) return json({ error: 'El contenido enviado no es válido.' }, 400);
      await env.DB.prepare(`INSERT INTO site_content (key, value, updated_by) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
        .bind(key, JSON.stringify(body.value), user.id).run();
      return json({ [key]: body.value });
    }

    return json({ error: 'Ruta no encontrada.' }, 404);
  } catch (error) {
    console.error('Ecopedal D1 API error:', error);
    return json({ error: 'Ocurrió un error interno. Inténtalo de nuevo.' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return json({ status: 'ok' });
    if (pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};