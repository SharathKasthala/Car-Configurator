import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

// GET /api/vehicles — active cars for the catalog
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT v.id, v.slug, b.name AS brand, v.model_name, v.category, v.body_type, v.drivetrain,
             v.base_price, v.model_3d_url,
             (SELECT count(*) FROM part_fitment f JOIN parts p ON p.id = f.part_id
               WHERE f.vehicle_id = v.id AND p.is_active)::int AS part_count
      FROM vehicles v JOIN brands b ON b.id = v.brand_id
      WHERE v.is_active
      ORDER BY b.name, v.model_name`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/vehicles/:slug — one car with its paint options and finishes
router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT v.*, b.name AS brand
      FROM vehicles v JOIN brands b ON b.id = v.brand_id
      WHERE v.slug = $1 AND v.is_active`, [req.params.slug])
    if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' })
    const vehicle = rows[0]
    const paints = await query('SELECT id, name, hex_color, price FROM paint_options WHERE vehicle_id = $1 ORDER BY sort_order', [vehicle.id])
    const finishes = await query('SELECT id, name, price FROM paint_finishes ORDER BY price')
    res.json({ ...vehicle, paints: paints.rows, finishes: finishes.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/vehicles/:slug/parts — active parts that fit this car, plus part rules
router.get('/:slug/parts', async (req, res) => {
  try {
    const v = await query('SELECT id FROM vehicles WHERE slug = $1 AND is_active', [req.params.slug])
    if (!v.rows.length) return res.status(404).json({ error: 'Vehicle not found' })
    const vehicleId = v.rows[0].id

    const parts = await query(`
      SELECT p.id, p.name, p.part_brand, p.price, p.stock, p.is_visual, p.specs, c.name AS category,
             (SELECT url FROM part_media m WHERE m.part_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
      FROM parts p
      JOIN part_categories c ON c.id = p.category_id
      JOIN part_fitment f ON f.part_id = p.id AND f.vehicle_id = $1
      WHERE p.is_active
      ORDER BY c.name, p.price`, [vehicleId])

    const ids = parts.rows.map((p) => p.id)
    const rules = await query(`
      SELECT part_id, related_part_id, rule_type FROM part_rules
      WHERE part_id = ANY($1::uuid[]) OR related_part_id = ANY($1::uuid[])`, [ids])

    res.json({ parts: parts.rows, rules: rules.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router