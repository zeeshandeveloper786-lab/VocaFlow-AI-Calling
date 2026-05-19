import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import router from './routes/index.js'
import authRouter from './routes/auth.js'
import webhooksRouter from './routes/webhooks.js'

const app = express()

app.set('trust proxy', 1) // trust X-Forwarded-Proto from ngrok / reverse proxies

app.use(cors())
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/webhooks', webhooksRouter)
app.use('/auth', authRouter)
app.use(router)

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
})

export default app
