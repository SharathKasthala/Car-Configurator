import { Router } from 'express'
import { query } from '../db.js'
import { handle } from '../lib.js'

const router = Router()

// GET /api/parts/meta — categories and brands for the filters
router.get('/meta', handle(async (req, res) => {
  const cats = await query('SELECT name FROM part_categories ORDER BY name')
  const brands = await query('SELECT DISTINCT part_brand FROM parts WHERE is_active ORDER BY part_brand')
  res.json({ categories: cats.rows.map((r) => r.name), brands: brands.rows.map((r) => r.part_brand) })
}))

// GET /api/parts?vehicle=slug&fitOnly=1&q=&category=&brands=a,b&min=&max=&visual=visual|hidden&sort=pop|low|high
router.get('/', handle(async (req, res) => {
  const { vehicle, fitOnly, q, category, brands, min, max, visual, sort } = req.query
  const params = []
  const where = ['p.is_active']
  const add = (v) => { params.push(v); return `$${params.length}` }

  let vehicleId = null
  if (vehicle) {
    const v = await query('SELECT id FROM vehicles WHERE slug = $1', [vehicle])
    vehicleId = v.rows[0]?.id || null
  }
  const fitsExpr = vehicleId
    ? `EXISTS (SELECT 1 FROM part_fitment f WHERE f.part_id = p.id AND f.vehicle_id = ${add(vehicleId)})`
    : 'NULL'
  if (vehicleId && fitOnly === '1') where.push(fitsExpr)
  if (q) where.push(`(p.name ILIKE ${add('%' + q + '%')} OR p.part_brand ILIKE $${params.length} OR c.name ILIKE $${params.length})`)
  if (category && category !== 'All') where.push(`c.name = ${add(category)}`)
  if (brands) where.push(`p.part_brand = ANY(${add(String(brands).split(','))}::text[])`)
  if (min) where.push(`p.price >= ${add(Number(min))}`)
  if (max) where.push(`p.price < ${add(Number(max))}`)
  if (visual === 'visual') where.push('p.is_visual')
  if (visual === 'hidden') where.push('NOT p.is_visual')

  const order = { low: 'p.price ASC', high: 'p.price DESC' }[sort] ||
    '(SELECT count(*) FROM order_items oi WHERE oi.part_id = p.id) DESC, p.name'

  const { rows } = await query(`
    SELECT p.id, p.name, p.part_brand, p.price, p.stock, p.is_visual, p.specs, c.name AS category,
           ${fitsExpr} AS fits,
           (SELECT url FROM part_media m WHERE m.part_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
    FROM parts p JOIN part_categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY ${order}`, params)
  res.json(rows)
}))

export default router