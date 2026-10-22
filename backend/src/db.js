import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000 });

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export async function initializeDatabase() {
  const schema = await readFile(schemaPath, 'utf8');
  await pool.query(schema);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) son obligatorios.');
  }
  const adminHash = await bcrypt.hash(adminPassword, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Administración Ecopedal', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, adminHash],
  );

  await pool.query(
    `INSERT INTO site_content (key, value) VALUES
      ('banner', '{"title":"Tu ciudad, a otro ritmo.","text":"Encuentra una bici cerca de ti y empieza a explorar."}'::jsonb),
      ('faqs', '[{"id":"faq-1","question":"¿Qué necesito para rentar una bicicleta?","answer":"Crea tu cuenta, elige una bici y envía una solicitud al propietario."},{"id":"faq-2","question":"¿Cómo publico mi bicicleta?","answer":"Regístrate como propietario y envía los detalles para su revisión."}]'::jsonb),
      ('blogs', '[{"id":"blog-1","title":"Cinco rutas para redescubrir la ciudad","summary":"Ideas para conocer nuevos barrios sobre dos ruedas.","status":"Publicado"}]'::jsonb)
     ON CONFLICT (key) DO NOTHING`,
  );

  const bikeCount = await pool.query('SELECT COUNT(*)::int AS total FROM bikes');
  if (bikeCount.rows[0].total === 0) {
    const seedEmail = `catalogo-${randomBytes(4).toString('hex')}@ecopedal.invalid`;
    const seedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const host = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Anfitrión Ecopedal', $1, $2, 'owner') RETURNING id`,
      [seedEmail, seedPassword],
    );
    const bikes = [
      ['Vía Verde', 'Urbana', 45, 'Roma Norte, CDMX', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85', 4.9],
      ['Sierra 29', 'Montaña', 75, 'Condesa, CDMX', 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=900&q=85', 4.8],
      ['Ruta Clásica', 'Carretera', 90, 'Coyoacán, CDMX', 'https://images.unsplash.com/photo-1511994298241-608e28f14fde?auto=format&fit=crop&w=900&q=85', 5.0],
      ['Ciudad Compacta', 'Urbana', 38, 'Juárez, CDMX', 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=900&q=85', 4.7],
    ];
    for (const bike of bikes) {
      await pool.query(
        `INSERT INTO bikes (owner_id, name, type, price_per_hour, location, image_url, status, rating)
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)`,
        [host.rows[0].id, ...bike],
      );
    }
  }
}
