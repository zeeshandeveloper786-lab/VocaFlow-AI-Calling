import db from '../lib/db.js'

export function allowRoles(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.sendStatus(401)
      }

      const tenantUser = await db.tenantUser.findUnique({
        where: {
          userId_tenantId: {
            userId: req.user.id,
            tenantId: req.user.tenantId
          }
        }
      })

      if (!tenantUser) {
        return res.sendStatus(403)
      }

      if (tenantUser.role === 'SUPER_ADMIN') {
        next()
        return
      }

      if (!roles.includes(tenantUser.role)) {
        return res.sendStatus(403)
      }

      next()
    } catch (err) {
      res.sendStatus(500)
    }
  }
}
