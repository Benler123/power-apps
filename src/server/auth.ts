import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const projectId = process.env.FIREBASE_PROJECT_ID;
const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/** Google's public keys for Firebase-issued ID tokens; no service account needed to verify them. */
const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export interface AuthenticatedUser {
  uid: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const authEnabled = Boolean(projectId);

function isAllowed(email: string): boolean {
  if (allowedEmails.length > 0) {
    return allowedEmails.includes(email);
  }
  if (allowedDomain) {
    return email.endsWith(`@${allowedDomain.toLowerCase()}`);
  }
  return true;
}

async function verifyIdToken(token: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email || payload.email_verified !== true) {
    throw new Error('Token is missing a verified email');
  }
  if (typeof payload.sub !== 'string') {
    throw new Error('Token is missing a subject');
  }
  return { uid: payload.sub, email };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!authEnabled) {
    next();
    return;
  }

  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const user = await verifyIdToken(token);
    if (!isAllowed(user.email)) {
      res.status(403).json({ error: 'Account is not allowed to administer feature flags' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
