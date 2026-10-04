import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

// GET /api/health — confirms the server is up and the database is reachable
router.get('/', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ server: 'ok', database: 'connected' })
  } catch (err) {
    res.status(500).json({ server: 'ok', database: 'not connected', error: err.message })
  }
})

export default router
