import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

export const apiRouter = Router();
apiRouter.use(authenticate);
const bikeFields = `b.id, b.owner_id AS "ownerId", b.name, b.type, b.price_per_hour AS price,
  b.location, b.image_url AS image, b.status, b.rating, u.name AS "ownerName"`;

apiRouter.get('/bikes', async (request, response, next) => {
  try {
    let query = `SELECT ${bikeFields} FROM bikes b JOIN users u ON u.id = b.owner_id`;
    const values = [];
    if (request.user.role === 'admin') query += ' ORDER BY b.created_at DESC';
    else if (request.user.role === 'owner') {
      query += ' WHERE b.owner_id = $1 ORDER BY b.created_at DESC';
      values.push(request.user.id);
    } else {
      query += ` WHERE b.status = 'approved' ORDER BY b.created_at DESC`;
    }
    response.json({ bikes: (await pool.query(query, values)).rows });
  } catch (error) { next(error); }
});

apiRouter.post('/bikes', allowRoles('owner'), async (request, response, next) => {
  try {
    const { name, type, price, location, image } = request.body ?? {};
    const allowedTypes = ['Urbana', 'Montaña', 'Carretera', 'Eléctrica', 'Plegable'];
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80
      || !allowedTypes.includes(type) || !Number.isInteger(Number(price)) || Number(price) < 1 || Number(price) > 10000
      || typeof location !== 'string' || location.trim().length < 2 || location.length > 120
      || typeof image !== 'string' || !validImageUrl(image)) {
      return response.status(400).json({ error: 'Revisa el nombre, tipo, precio, ubicación y URL de la foto.' });
    }
    const result = await pool.query(
      `INSERT INTO bikes (owner_id, name, type, price_per_hour, location, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${bikeFields}`,
      [request.user.id, name.trim(), type, Number(price), location.trim(), image.trim()],
    );
    response.status(201).json({ bike: result.rows[0] });
  } catch (error) { next(error); }
});

apiRouter.patch('/bikes/:id/status', allowRoles('admin'), async (request, response, next) => {
  try {
    const { status } = request.body ?? {};
    if (!['approved', 'paused', 'rejected'].includes(status)) return response.status(400).json({ error: 'Estado de bicicleta no válido.' });
    const result = await pool.query('UPDATE bikes SET status = $1 WHERE id = $2 RETURNING id, status', [status, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'No encontramos esa bicicleta.' });
    response.json({ bike: result.rows[0] });
  } catch (error) { next(error); }
});

apiRouter.get('/reservations', async (request, response, next) => {
  try {
    let query = `SELECT r.id, r.bike_id AS "bikeId", r.owner_id AS "ownerId", r.renter_id AS "renterId",
      r.start_date::text AS date, r.hours, r.total, r.status, b.name AS "bikeName", renter.name AS "renterName"
      FROM reservations r JOIN bikes b ON b.id = r.bike_id JOIN users renter ON renter.id = r.renter_id`;
    const values = [];
    if (request.user.role === 'owner') {
      query += ' WHERE r.owner_id = $1'; values.push(request.user.id);
    } else if (request.user.role === 'renter') {
      query += ' WHERE r.renter_id = $1'; values.push(request.user.id);
    }
    query += ' ORDER BY r.created_at DESC';
    response.json({ reservations: (await pool.query(query, values)).rows });
  } catch (error) { next(error); }
});

apiRouter.post('/reservations', allowRoles('renter'), async (request, response, next) => {
  const { bikeId, date, hours } = request.body ?? {};
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isInteger(Number(hours)) || Number(hours) < 1 || Number(hours) > 24
    || date < new Date().toISOString().slice(0, 10)) {
    return response.status(400).json({ error: 'La fecha o la duración de la reserva no son válidas.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bikeResult = await client.query(
      `SELECT id, owner_id, price_per_hour FROM bikes WHERE id = $1 AND status = 'approved' FOR UPDATE`,
      [bikeId],
    );
    const bike = bikeResult.rows[0];
    if (!bike || bike.owner_id === request.user.id) {
      await client.query('ROLLBACK');
      return response.status(404).json({ error: 'La bicicleta no está disponible para reservar.' });
    }
    const result = await client.query(
      `INSERT INTO reservations (bike_id, owner_id, renter_id, start_date, hours, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, bike_id AS "bikeId", owner_id AS "ownerId", renter_id AS "renterId", start_date::text AS date, hours, total, status`,
      [bike.id, bike.owner_id, request.user.id, date, Number(hours), bike.price_per_hour * Number(hours)],
    );
    await client.query('COMMIT');
    response.status(201).json({ reservation: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); next(error);
  } finally { client.release(); }
});

apiRouter.patch('/reservations/:id/status', allowRoles('owner'), async (request, response, next) => {
  try {
    const { status } = request.body ?? {};
    if (!['confirmed', 'rejected'].includes(status)) return response.status(400).json({ error: 'Estado de reserva no válido.' });
    const result = await pool.query(
      `UPDATE reservations SET status = $1 WHERE id = $2 AND owner_id = $3 AND status = 'pending' RETURNING id, status`,
      [status, request.params.id, request.user.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'La solicitud ya no está pendiente o no te pertenece.' });
    response.json({ reservation: result.rows[0] });
  } catch (error) { next(error); }
});

apiRouter.get('/admin/users', allowRoles('admin'), async (_request, response, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, status, created_at AS "createdAt" FROM users ORDER BY created_at DESC');
    response.json({ users: result.rows });
  } catch (error) { next(error); }
});

apiRouter.patch('/admin/users/:id', allowRoles('admin'), async (request, response, next) => {
  try {
    const { role, status } = request.body ?? {};
    const roles = ['admin', 'editor', 'owner', 'renter'];
    const statuses = ['active', 'suspended'];
    if ((role !== undefined && !roles.includes(role)) || (status !== undefined && !statuses.includes(status))) {
      return response.status(400).json({ error: 'Rol o estado no válido.' });
    }
    if (request.params.id === request.user.id && (role === undefined || role !== 'admin' || status === 'suspended')) {
      return response.status(400).json({ error: 'No puedes quitarte tu propio acceso de administrador.' });
    }
    const result = await pool.query(
      `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status)
       WHERE id = $3 RETURNING id, name, email, role, status`,
      [role ?? null, status ?? null, request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'No encontramos esa cuenta.' });
    response.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

apiRouter.get('/content', async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT key, value FROM site_content WHERE key IN ('banner', 'blogs', 'faqs')");
    const content = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
    content.blogs = (content.blogs ?? []).filter((blog) => blog.status === 'Publicado');
    response.json({ content });
  } catch (error) { next(error); }
});

apiRouter.put('/content/:key', allowRoles('editor', 'admin'), async (request, response, next) => {
  try {
    const { key } = request.params;
    const allowed = new Set(['banner', 'blogs', 'faqs']);
    const value = request.body?.value;
    if (!allowed.has(key) || value === undefined || !validContent(key, value)) {
      return response.status(400).json({ error: 'El contenido enviado no es válido.' });
    }
    const result = await pool.query(
      `INSERT INTO site_content (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING key, value`,
      [key, JSON.stringify(value), request.user.id],
    );
    response.json({ [key]: result.rows[0].value });
  } catch (error) { next(error); }
});

function validImageUrl(value) {
  try { const parsed = new URL(value); return parsed.protocol === 'https:'; } catch { return false; }
}
function validContent(key, value) {
  if (key === 'banner') return typeof value.title === 'string' && value.title.length <= 100 && typeof value.text === 'string' && value.text.length <= 240;
  if (key === 'blogs' || key === 'faqs') return Array.isArray(value) && value.length <= 200 && value.every((item) => item && typeof item.id === 'string');
  return false;
}
