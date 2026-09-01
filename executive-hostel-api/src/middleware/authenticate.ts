import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Requires a valid Bearer access token. Attaches req.user on success.
 * This is the ONLY place identity is established - route handlers must
 * never trust a user id passed in the request body/query for authorization
 * decisions, only req.user (set here from the verified token).
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing or malformed Authorization header." } });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, permissions: payload.permissions || [] };
    next();
  } catch {
    return res.status(401).json({ error: { code: "TOKEN_INVALID", message: "Access token is invalid or expired." } });
  }
}
