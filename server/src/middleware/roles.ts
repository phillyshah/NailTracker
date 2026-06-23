import type { Request, Response, NextFunction } from 'express';

/** Reject anyone who isn't an admin. Assumes authMiddleware has run. */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

/**
 * Reject distributor-role accounts outright. Use on admin/user-only mutating
 * areas (e.g. transfers) that a scoped distributor login must never reach.
 */
export function denyDistributor(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'distributor') {
    return res.status(403).json({ success: false, error: 'Not available for distributor accounts' });
  }
  next();
}

/**
 * Allow admins through; allow distributor accounts only when they're acting on
 * their OWN distributor. `getDistributorId` pulls the target id from the request
 * (body or query). Everyone else is rejected.
 */
export function adminOrOwnDistributor(getDistributorId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'admin') return next();
    if (req.user?.role === 'distributor') {
      const target = getDistributorId(req);
      if (target && target === req.user.distributorId) return next();
      return res.status(403).json({ success: false, error: 'You can only act on your own distributor' });
    }
    return res.status(403).json({ success: false, error: 'Access denied' });
  };
}
