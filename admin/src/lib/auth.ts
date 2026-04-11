import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export type UserRole = 'admin' | 'viewer';

export const SESSION_COOKIE_NAME = 'chiateam_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getRequiredEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== 'production') {
    return fallback;
  }

  throw new Error(`${name} is required in production`);
}

function getSessionSecret() {
  return getRequiredEnv(
    'ADMIN_SESSION_SECRET',
    'local-admin-session-secret-change-me'
  );
}

export function getInternalApiAuthToken() {
  return getRequiredEnv(
    'INTERNAL_API_AUTH_TOKEN',
    'local-internal-api-token-change-me'
  );
}

function safeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function sign(value: string) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url');
}

function encodeSession(role: UserRole) {
  const payload = Buffer.from(
    JSON.stringify({
      role,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    })
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function decodeSession(token?: string | null): { role: UserRole } | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || !safeCompare(signature, sign(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (
      (parsed.role !== 'admin' && parsed.role !== 'viewer') ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return { role: parsed.role };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest) {
  return decodeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function validatePassword(password: string): UserRole | null {
  const adminPassword = getRequiredEnv('ADMIN_PASSWORD', 'admin123');
  const viewerPassword = getRequiredEnv('VIEWER_PASSWORD', 'viewer123');

  if (safeCompare(password, adminPassword)) {
    return 'admin';
  }

  if (safeCompare(password, viewerPassword)) {
    return 'viewer';
  }

  return null;
}

export function setSessionCookie(response: NextResponse, role: UserRole) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSession(role),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
