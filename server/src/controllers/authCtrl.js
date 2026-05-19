import bcrypt from 'bcryptjs'
import db from '../lib/db.js'
import { signAccess, signRefresh, verifyRefresh } from '../lib/token.js'
import jwt from 'jsonwebtoken'

export const register = async (req, res, next) => {
  const { name, orgName, email, password } = req.body

  if (!orgName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    console.log('📝 Registration function activated')
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: orgName,
          phone: '',
          plan: 'free'
        }
      })

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash
        }
      })

      const tenantUser = await tx.tenantUser.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'TENANT_ADMIN'
        }
      })

      return { tenant, user, tenantUser }
    })

    const payload = { id: result.user.id, email: result.user.email, tenantId: result.tenant.id, role: result.tenantUser.role }
    const accessToken = signAccess(payload)
    const refreshToken = signRefresh(payload)

    console.log('✅ Registration successful')
    res.status(201).json({ accessToken, refreshToken })
  } catch (err) {
    next(err)
  }
}

export const login = async (req, res, next) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    console.log('🔑 Login function activated')
    const user = await db.user.findUnique({
      where: { email },
      include: { tenantUsers: true }
    })
    if (!user || !user.tenantUsers.length) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const tenantUser = user.tenantUsers[0]
    const payload = { id: user.id, tenantId: tenantUser.tenantId, role: tenantUser.role }
    const accessToken = signAccess(payload)
    const refreshToken = signRefresh(payload)

    console.log('✅ Login successful')
    res.json({ accessToken, refreshToken })
  } catch (err) {
    next(err)
  }
}

export const refresh = async (req, res, next) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' })
  }

  try {
    console.log('🔄 Token refresh function activated')
    const payload = verifyRefresh(refreshToken)
    const accessToken = signAccess({ id: payload.id, tenantId: payload.tenantId, role: payload.role })

    console.log('✅ Token refreshed successfully')
    res.json({ accessToken })
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

export const logout = (req, res) => {
  console.log('🚪 Logout function activated')
  res.sendStatus(200)
}

export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id }
    })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid current password' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await db.user.update({
      where: { id: req.user.id },
      data: { passwordHash }
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
