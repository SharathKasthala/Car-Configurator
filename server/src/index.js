import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import vehicleRoutes from './routes/vehicles.js'
import partRoutes from './routes/parts.js'
import quoteRoutes from './routes/quote.js'
import buildRoutes from './routes/builds.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import adminRoutes from './routes/admin.js'

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing in server/.env')
  process.exit(1)
}

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/parts', partRoutes)
app.use('/api/quote', quoteRoutes)
app.use('/api/builds', buildRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)

// Fallback for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))