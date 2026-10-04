import { Router } from 'express'
import { priceBuild } from '../services/pricing.js'

const router = Router()

// POST /api/quote — checks a build and returns its price breakdown
// body: { vehicleId, paintOptionId, finishId, partIds: [] }
router.post('/', async (req, res) => {
  try {
    const result = await priceBuild(req.body || {})
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
