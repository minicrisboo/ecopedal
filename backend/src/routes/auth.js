import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const allowedSignupRoles = new Set(['renter', 'owner']);
const cookieName = 'ecopedal_session';
const sameSite = process.env.SESSION_COOKIE_SAME_SITE ?? 'lax';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite,
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
};

function issueSession(response, user) {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: user.id,
    issuer: 'ecopedal-api',
    audience: 'ecopedal-web',
    expiresIn: '12h',
  });
  response.cookie(cookieName, token, cookieOptions);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}

authRouter.post('/register', loginLimit, async (request, response, next) => {
  try {
    const { name, email, password, accountType = 'renter' } = request.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return response.status(400).json({ error: 'Escribe un nombre de entre 2 y 100 caracteres.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return response.status(400).json({ error: 'Escribe un correo válido.' });
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 72) {
      return response.status(400).json({ error: 'La contraseña debe tener entre 10 y 72 caracteres.' });
    }
    if (!allowedSignupRoles.has(accountType)) {
      return response.status(400).json({ error: 'El tipo de cuenta no es válido.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, status`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, accountType],
    );
    const user = result.rows[0];
    issueSession(response, user);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    next(error);
  }
});

authRouter.post('/login', loginLimit, async (request, response, next) => {
  try {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return response.status(400).json({ error: 'Escribe tu correo y contraseña.' });
    }
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, status FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    if (user.status !== 'active') return response.status(403).json({ error: 'Esta cuenta está suspendida.' });
    issueSession(response, user);
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  response.status(204).end();
});

authRouter.get('/me', authenticate, (request, response) => {
  response.json({ user: publicUser(request.user) });
});
