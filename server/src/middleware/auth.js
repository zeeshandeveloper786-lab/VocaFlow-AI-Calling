import { verifyAccess } from '../lib/token.js'
import prisma from '../lib/db.js'

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyAccess(token)
    const tenantUser = await prisma.tenantUser.findFirst({ where: { userId: decoded.id }, include: { user: true } })
    if (!tenantUser) return res.status(401).json({ success: false, message: "Access denied" })
    req.user = { 
      id: tenantUser.userId, 
      email: tenantUser.user.email, 
      tenantId: tenantUser.tenantId, 
      role: tenantUser.role,
      isImpersonating: decoded.isImpersonating || false,
      originalUserId: decoded.originalUserId
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export const blockSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN' && !req.user.isImpersonating) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
