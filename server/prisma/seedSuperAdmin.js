
import prisma from '../src/lib/db.js'
import bcrypt from 'bcryptjs'

async function main() {
  const email = 'superadmin@vocaflow.com'
  const password = 'SuperAdmin123!'

  await prisma.$transaction(async (tx) => {
    await tx.tenantUser.deleteMany({})
    await tx.user.deleteMany({})
    await tx.tenant.deleteMany({})

    const passwordHash = await bcrypt.hash(password, 12)

    const tenant = await tx.tenant.create({
      data: {
        name: 'Super Admin Org',
        phone: '',
        plan: 'enterprise'
      }
    })

    const user = await tx.user.create({
      data: {
        name: 'Super Admin',
        email,
        passwordHash
      }
    })

    await tx.tenantUser.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'SUPER_ADMIN'
      }
    })
  })

  console.log('✅ Super admin created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
