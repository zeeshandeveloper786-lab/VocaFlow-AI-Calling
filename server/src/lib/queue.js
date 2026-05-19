import '../env.js'
import { Queue } from 'bullmq'
import redis from './redis.js'

const queue = new Queue('calls', { connection: redis })

export const addCallJob = async (leadId, agentId, tenantId) => {
  await queue.add('call', { leadId, agentId, tenantId }, {
    jobId: leadId,
    delay: 0,
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 }
  })
}

export { queue as callQueue }
export default queue
