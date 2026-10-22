import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

function tokenFromRequest(request) {
  const cookieToken = request.cookies?.ecopedal_session;
  if (cookieToken) return cookieToken;
  const authorization = request.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
}

export async function authenticate(request, response, next) {
  const token = tokenFromRequest(request);
  if (!token) return response.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'ecopedal-api', audience: 'ecopedal-web' });
    const result = await pool.query(
      'SELECT id, name, email, role, status FROM users WHERE id = $1',
      [claims.sub],
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active') return response.status(401).json({ error: 'La sesión ya no está activa.' });
    request.user = user;
    next();
  } catch {
    response.status(401).json({ error: 'Sesión inválida o vencida.' });
  }
}

export function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

export function allowFrontendOrigins(request, response, next) {
  const origin = request.get('origin');
  if (!origin) return next();

  const forwardedHost = request.get('x-forwarded-host');
  const forwardedProto = request.get('x-forwarded-proto');
  const host = forwardedHost ?? request.get('host');
  const protocol = forwardedProto ?? request.protocol;
  const sameOrigin = origin === `${protocol}://${host}`;
  const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  if (!sameOrigin && !allowedOrigins.includes(origin)) {
    return response.status(403).json({ error: 'Origen de frontend no permitido.' });
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ecopedal-Client');
  response.setHeader('Access-Control-Max-Age', '600');
  response.vary('Origin');

  if (request.method === 'OPTIONS') return response.status(204).end();
  next();
}

export function enforceSameOrigin(request, response, next) {
  const origin = request.get('origin');
  if (!origin) return next();
  const forwardedHost = request.get('x-forwarded-host');
  const forwardedProto = request.get('x-forwarded-proto');
  const host = forwardedHost ?? request.get('host');
  const protocol = forwardedProto ?? request.protocol;
  const sameOrigin = origin === `${protocol}://${host}`;
  const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!sameOrigin && !allowedOrigins.includes(origin)) {
    return response.status(403).json({ error: 'Origen de solicitud no permitido.' });
  }
  if (!sameOrigin && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    && request.get('x-ecopedal-client') !== 'web') {
    return response.status(403).json({ error: 'Solicitud de navegador no válida.' });
  }
  next();
}
