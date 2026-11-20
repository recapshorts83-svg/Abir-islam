import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db.ts';
import type { AdminUser } from '../src/types/video.ts';

const COOKIE_NAME = 'vvp_admin_session';
const SECRET_FILE = path.resolve(process.cwd(), 'data', '.session-secret');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  adminId: number;
  username: string;
  exp: number;
}

interface LoginAttemptState {
  count: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttemptState>();

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const dir = path.dirname(SECRET_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

function signToken(payloadB64: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
}

export function createSessionToken(admin: AdminUser): string {
  const payload: SessionPayload = {
    adminId: admin.id,
    username: admin.username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signToken(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = signToken(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.adminId !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function computeCsrfToken(sessionToken: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`csrf:${sessionToken}`)
    .digest('base64url');
}

export function setAdminSessionCookie(res: Response, req: Request, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAdminSessionCookie(res: Response, req: Request): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

function extractSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : undefined;
}

export function getAuthenticatedAdmin(req: Request): { admin: AdminUser; token: string; csrfToken: string } | null {
  const rawToken = extractSessionToken(req);
  const payload = verifySessionToken(rawToken);
  if (!payload || !rawToken) return null;

  const db = getDb();
  const row = db
    .prepare('SELECT id, username, name FROM admins WHERE id = ? LIMIT 1')
    .get(payload.adminId) as AdminUser | undefined;
  if (!row) return null;

  return {
    admin: row,
    token: rawToken,
    csrfToken: computeCsrfToken(rawToken),
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuthenticatedAdmin(req);
  if (!auth) {
    res.status(401).json({ ok: false, error: 'Administrator authentication required.' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const sentCsrf = String(req.headers['x-csrf-token'] ?? '');
    const sentBuf = Buffer.from(sentCsrf, 'utf8');
    const expBuf = Buffer.from(auth.csrfToken, 'utf8');
    if (sentBuf.length !== expBuf.length || !crypto.timingSafeEqual(sentBuf, expBuf)) {
      res.status(403).json({ ok: false, error: 'Invalid or expired security token. Please refresh.' });
      return;
    }
  }

  (req as Request & { admin?: AdminUser }).admin = auth.admin;
  next();
}

export function checkLoginRateLimit(ip: string): { allowed: true } | { allowed: false; retryMinutes: number } {
  const state = loginAttempts.get(ip);
  if (!state) return { allowed: true };
  if (state.lockedUntil > Date.now()) {
    const retryMinutes = Math.max(1, Math.ceil((state.lockedUntil - Date.now()) / 60000));
    return { allowed: false, retryMinutes };
  }
  if (state.lockedUntil > 0 && state.lockedUntil <= Date.now()) {
    loginAttempts.delete(ip);
  }
  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const prev = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  const nextCount = prev.count + 1;
  const lockedUntil = nextCount >= 6 ? Date.now() + 10 * 60 * 1000 : 0;
  loginAttempts.set(ip, { count: nextCount, lockedUntil });
}

export function clearFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}
