import { verifyToken } from '@clerk/backend';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!secretKey || !token) {
    res.status(401).json({
      error: !secretKey ? 'CLERK_NOT_CONFIGURED' : 'AUTHENTICATION_REQUIRED',
      message: !secretKey
        ? 'The backend is missing CLERK_SECRET_KEY. Add it to the backend environment and restart the server.'
        : 'Sign in with Clerk to use GradGuide.',
    });
    return;
  }

  try {
    const claims = await verifyToken(token, { secretKey });
    if (typeof claims.sub !== 'string' || !claims.sub) {
      res.status(401).json({ error: 'INVALID_AUTHENTICATION', message: 'The Clerk token has no user identity.' });
      return;
    }
    req.userId = claims.sub;
    next();
  } catch (error) {
    console.warn('Clerk token verification failed', error);
    res.status(401).json({ error: 'INVALID_AUTHENTICATION', message: 'Your sign-in session is invalid or expired.' });
  }
}

export function authenticatedUserId(req: Request): string {
  if (!req.userId) {
    throw new Error('Authenticated user ID is missing.');
  }
  return req.userId;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!secretKey || !token) {
    req.userId = 'anonymous';
    next();
    return;
  }

  try {
    const claims = await verifyToken(token, { secretKey });
    req.userId = typeof claims.sub === 'string' && claims.sub ? claims.sub : 'anonymous';
  } catch {
    req.userId = 'anonymous';
  }
  next();
}

