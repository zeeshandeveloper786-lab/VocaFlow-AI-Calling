import { callWorker } from './callWorker.js'

if (callWorker) {
  callWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`)
  })
  callWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err)
  })
  callWorker.on('active', (job) => {
    console.log(`🔄 Job ${job.id} is now active`)
  })
  console.log('⚙️ Call worker started and listening for jobs')
} else {
  console.error('⚠️ Call worker not available')
}
