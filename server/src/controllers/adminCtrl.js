import db from '../lib/db.js'
import bcrypt from 'bcryptjs'

export async function getProfile(req, res, next) {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id }
    })
    res.json({ id: user.id, name: user.name, email: user.email })
  } catch (err) {
    next(err)
  }
}

export async function allTenants(req, res, next) {
  try {
    const superAdminTenantUser = await db.tenantUser.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { tenantId: true }
    })
    const superAdminTenantId = superAdminTenantUser?.tenantId || null

    const tenants = await db.tenant.findMany({
      where: { NOT: { id: superAdminTenantId } },
      orderBy: { createdAt: 'desc' },
      include: {
        tenantUsers: {
          where: { role: 'TENANT_ADMIN' },
          take: 1,
          include: { user: true }
        },
        _count: {
          select: {
            agents: true,
            leads: true,
            calls: true,
            docs: true
          }
        }
      }
    })

    const formatted = tenants.map(t => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      plan: t.plan,
      createdAt: t.createdAt,
      ownerName: t.tenantUsers[0]?.user?.name || '-',
      ownerEmail: t.tenantUsers[0]?.user?.email || '-',
      agentCount: t._count.agents,
      leadCount: t._count.leads,
      callCount: t._count.calls,
      workflowCount: 0,
      kbCount: t._count.docs
    }))

    res.json(formatted)
  } catch (err) {
    next(err)
  }
}

export async function tenantDetail(req, res, next) {
  try {
    const { id } = req.params
    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        tenantUsers: {
          where: { role: 'TENANT_ADMIN' },
          take: 1,
          include: { user: true }
        },
        agents: { orderBy: { createdAt: 'desc' } },
        leads: { orderBy: { createdAt: 'desc' } },
        calls: { orderBy: { createdAt: 'desc' } },
        docs: { orderBy: { createdAt: 'desc' } }
      }
    })

    const formatted = {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
      ownerName: tenant.tenantUsers[0]?.user?.name || '-',
      ownerEmail: tenant.tenantUsers[0]?.user?.email || '-',
      agents: tenant.agents,
      leads: tenant.leads,
      calls: tenant.calls,
      workflows: [],
      knowledgeBase: tenant.docs
    }

    res.json(formatted)
  } catch (err) {
    next(err)
  }
}

export async function updateTenant(req, res, next) {
  try {
    const { id } = req.params
    const { orgName, ownerName, ownerEmail, newPassword } = req.body

    const tenantUser = await db.tenantUser.findFirst({
      where: { tenantId: id, role: 'TENANT_ADMIN' }
    })

    const tenant = await db.tenant.update({
      where: { id },
      data: { name: orgName }
    })

    let user
    if (tenantUser) {
      const updateData = {}
      if (ownerName) updateData.name = ownerName
      if (ownerEmail) updateData.email = ownerEmail
      if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 12)

      user = await db.user.update({
        where: { id: tenantUser.userId },
        data: updateData
      })
    }

    res.json({ tenant, user })
  } catch (err) {
    next(err)
  }
}

export async function deleteTenant(req, res, next) {
  try {
    const { id } = req.params
    await db.$transaction(async (tx) => {
      const tenantUsers = await tx.tenantUser.findMany({
        where: { tenantId: id },
        select: { userId: true }
      })
      
      const userIds = tenantUsers.map(tu => tu.userId)
      
      if (userIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: userIds } }
        })
      }
      
      await tx.tenant.delete({ where: { id } })
    })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function updateSuperAdmin(req, res, next) {
  try {
    const { name, email, currentPassword, newPassword } = req.body

    const adminUser = await db.tenantUser.findFirst({
      where: { role: 'SUPER_ADMIN' },
      include: { user: true }
    })

    if (currentPassword && newPassword) {
      const valid = await bcrypt.compare(currentPassword, adminUser.user.passwordHash)
      if (!valid) {
        return res.status(401).json({ error: 'Invalid current password' })
      }
    }

    const updateData = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 12)

    const user = await db.user.update({
      where: { id: adminUser.userId },
      data: updateData
    })

    res.json({ id: user.id, name: user.name, email: user.email })
  } catch (err) {
    next(err)
  }
}

export async function stats(req, res, next) {
  try {
    const superAdminTenantUser = await db.tenantUser.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { userId: true, tenantId: true }
    })
    const superAdminUserId = superAdminTenantUser?.userId || null
    const superAdminTenantId = superAdminTenantUser?.tenantId || null

    const [allTenants, allUsers, agentCount, leadCount, callCount, recentTenants] = await Promise.all([
      db.tenant.findMany({ where: { NOT: { id: superAdminTenantId } } }),
      db.user.findMany(),
      db.agent.count(),
      db.lead.count(),
      db.call.count(),
      db.tenant.findMany({
        where: { NOT: { id: superAdminTenantId } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          tenantUsers: {
            where: { role: 'TENANT_ADMIN' },
            take: 1,
            include: { user: true }
          },
          _count: { select: { calls: true, leads: true } }
        }
      })
    ])

    const filteredUsers = allUsers.filter(u => u.id !== superAdminUserId)
    const userCount = filteredUsers.length
    const tenantCount = allTenants.length

    const recentFormatted = recentTenants.map(t => ({
      id: t.id,
      name: t.name,
      ownerName: t.tenantUsers[0]?.user?.name || '-',
      ownerEmail: t.tenantUsers[0]?.user?.email || '-',
      callCount: t._count.calls,
      leadCount: t._count.leads,
      createdAt: t.createdAt
    }))

    res.json({
      totalTenants: tenantCount,
      totalUsers: userCount,
      totalCalls: callCount,
      totalLeads: leadCount,
      totalAgents: agentCount,
      totalWorkflows: 0,
      recentTenants: recentFormatted
    })
  } catch (err) {
    next(err)
  }
}
