CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'renter' CHECK (role IN ('admin', 'editor', 'owner', 'renter')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bikes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Urbana', 'Montaña', 'Carretera', 'Eléctrica', 'Plegable')),
  price_per_hour INTEGER NOT NULL CHECK (price_per_hour BETWEEN 1 AND 10000),
  location TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'paused', 'rejected')),
  rating REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS bikes_status_idx ON bikes(status);
CREATE INDEX IF NOT EXISTS bikes_owner_idx ON bikes(owner_id);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  bike_id TEXT NOT NULL REFERENCES bikes(id) ON DELETE RESTRICT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  renter_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_date TEXT NOT NULL,
  hours INTEGER NOT NULL CHECK (hours BETWEEN 1 AND 24),
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reservations_owner_idx ON reservations(owner_id, status);
CREATE INDEX IF NOT EXISTS reservations_renter_idx ON reservations(renter_id, status);

CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status)
VALUES ('ecopedal-seed-owner', 'Anfitrión Ecopedal', 'catalogo@ecopedal.invalid', '!disabled!', 'owner', 'active');

INSERT OR IGNORE INTO bikes (id, owner_id, name, type, price_per_hour, location, image_url, status, rating) VALUES
  ('b-101', 'ecopedal-seed-owner', 'Vía Verde', 'Urbana', 45, 'Roma Norte, CDMX', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85', 'approved', 4.9),
  ('b-102', 'ecopedal-seed-owner', 'Sierra 29', 'Montaña', 75, 'Condesa, CDMX', 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=900&q=85', 'approved', 4.8),
  ('b-103', 'ecopedal-seed-owner', 'Ruta Clásica', 'Carretera', 90, 'Coyoacán, CDMX', 'https://images.unsplash.com/photo-1511994298241-608e28f14fde?auto=format&fit=crop&w=900&q=85', 'approved', 5.0),
  ('b-104', 'ecopedal-seed-owner', 'Ciudad Compacta', 'Urbana', 38, 'Juárez, CDMX', 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=900&q=85', 'approved', 4.7);

INSERT OR IGNORE INTO site_content (key, value) VALUES
  ('banner', '{"title":"Tu ciudad, a otro ritmo.","text":"Encuentra una bici cerca de ti y empieza a explorar."}'),
  ('faqs', '[{"id":"faq-1","question":"¿Qué necesito para rentar una bicicleta?","answer":"Crea tu cuenta, elige una bici y envía una solicitud al propietario."},{"id":"faq-2","question":"¿Cómo publico mi bicicleta?","answer":"Regístrate como propietario y envía los detalles para su revisión."}]'),
  ('blogs', '[{"id":"blog-1","title":"Cinco rutas para redescubrir la ciudad","summary":"Ideas para conocer nuevos barrios sobre dos ruedas.","status":"Publicado"}]');