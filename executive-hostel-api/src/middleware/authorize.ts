import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authenticate";

/**
 * Restricts a route to one or more roles.
 * Usage: router.get("/admin/x", authenticate, requireRole("administrator", "landlady"), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this resource." } });
    }
    next();
  };
}

/**
 * Restricts a route to users who hold a specific granular permission key
 * (see UserPermission model / docs Section 2 - e.g. "verify_payments",
 * "manage_settings"). This is what lets the landlady grant one admin the
 * ability to verify payments without also granting fee changes.
 */
export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
    }
    // landlady implicitly holds every permission
    if (req.user.role === "landlady") return next();
    if (!req.user.permissions.includes(permissionKey)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: `Missing required permission: ${permissionKey}` } });
    }
    next();
  };
}

/**
 * Allows a student to access only their own resource, OR an admin/landlady
 * to access any. `getOwnerUserId` extracts the resource's owning user id
 * (e.g. from a loaded Student record) - pass it in per-route since the
 * lookup differs (payments, maintenance requests, profile, etc.).
 */
export function requireSelfOrRole(getOwnerUserId: (req: AuthenticatedRequest) => Promise<string | null>, ...roles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
    }
    if (roles.includes(req.user.role)) return next();
    const ownerId = await getOwnerUserId(req);
    if (ownerId && ownerId === req.user.id) return next();
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You can only access your own records." } });
  };
}
