import './src/env.js'
import db from './src/lib/db.js'

async function main() {
  const number = process.env.TWILIO_PHONE_NUMBER
  if (!number) {
    console.error('TWILIO_PHONE_NUMBER not found in .env')
    process.exit(1)
  }

  console.log(`Searching for mappings for: ${number}`)

  // Get all tenants
  const tenants = await db.tenant.findMany()
  if (tenants.length === 0) {
    console.error('No tenants found in the database')
    process.exit(1)
  }

  let selectedTenant = null
  let selectedAgent = null

  // Find the first tenant that has an active agent
  for (const tenant of tenants) {
    const agent = await db.agent.findFirst({
      where: { tenantId: tenant.id, deletedAt: null }
    })
    if (agent) {
      selectedTenant = tenant
      selectedAgent = agent
      break
    }
  }

  if (!selectedTenant || !selectedAgent) {
    console.error('Could not find any tenant with an active agent in the database')
    process.exit(1)
  }

  console.log(`Selected Tenant: ${selectedTenant.name} (${selectedTenant.id})`)
  console.log(`Selected Agent: ${selectedAgent.name} (${selectedAgent.id})`)

  // Upsert phone number mapping
  const existing = await db.phoneNumber.findFirst({
    where: { number }
  })

  let phoneRecord
  if (existing) {
    phoneRecord = await db.phoneNumber.update({
      where: { id: existing.id },
      data: {
        tenantId: selectedTenant.id,
        agentId: selectedAgent.id,
        phoneType: 'INBOUND'
      }
    })
    console.log('Updated existing phone number mapping successfully:')
  } else {
    phoneRecord = await db.phoneNumber.create({
      data: {
        tenantId: selectedTenant.id,
        number,
        agentId: selectedAgent.id,
        phoneType: 'INBOUND'
      }
    })
    console.log('Created new phone number mapping successfully:')
  }

  console.dir(phoneRecord, { depth: null })
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
