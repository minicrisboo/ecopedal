import { app } from './app.js';
import { initializeDatabase, pool } from './db.js';

const port = Number(process.env.PORT ?? 3000);
const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta la variable de entorno ${key}.`);
}
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');

await initializeDatabase();
const server = app.listen(port, '0.0.0.0', () => console.log(`Ecopedal API escuchando en ${port}`));

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
