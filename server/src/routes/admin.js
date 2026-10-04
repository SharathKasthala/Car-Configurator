import { Router } from 'express'
import { query } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { loadOrders } from './orders.js'
import { loadBuilds } from '../services/buildData.js'
import { handle, isId } from '../lib.js'

const router = Router()
router.use(requireAdmin)

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const CATEGORIES = ['Sports', 'Off-road', 'SUV', 'Sedan', 'Electric']
const DRIVES = ['AWD', 'RWD', 'FWD', '4WD']
const DEFAULT_PAINTS = [
  ['Graphite grey', '#4A4F55', 0], ['Obsidian black', '#1A1C1F', 0], ['Arctic white', '#E6E7E9', 0],
  ['Racing red', '#B3261E', 500], ['Deep ocean blue', '#24427A', 500], ['Forest green', '#2F4A3A', 500],
]
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const toSketchfabEmbed = (url) => {
  const m = String(url || '').match(/sketchfab\.com\/(?:3d-models\/[^/?#]*-|models\/)([0-9a-f]{32})/i)
  return m ? `https://sketchfab.com/models/${m[1]}/embed` : url || null
}

router.get('/meta', handle(async (req, res) => {
  const brands = await query('SELECT name FROM brands ORDER BY name')
  const cats = await query('SELECT name FROM part_categories ORDER BY name')
  res.json({ brands: brands.rows.map((r) => r.name), partCategories: cats.rows.map((r) => r.name), carCategories: CATEGORIES, drivetrains: DRIVES, statuses: STATUSES })
}))

// ---------- Overview ----------
router.get('/stats', handle(async (req, res) => {
  const s = await query(`
    SELECT count(*)::int AS orders,
           COALESCE(sum(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
           COALESCE(avg(total) FILTER (WHERE status <> 'cancelled'), 0) AS average,
           count(*) FILTER (WHERE status = 'pending')::int AS pending
    FROM orders`)
  const low = await query('SELECT id, name, stock FROM parts WHERE is_active AND stock <= 4 ORDER BY stock, name LIMIT 8')
  const recent = await loadOrders('true', [])
  res.json({ ...s.rows[0], lowStock: low.rows, recent: recent.slice(0, 5) })
}))

// ---------- Orders ----------
router.get('/orders', handle(async (req, res) => {
  const params = []
  const where = ['true']
  if (STATUSES.includes(req.query.status)) { params.push(req.query.status); where.push(`o.status = $${params.length}`) }
  if (req.query.q) { params.push('%' + req.query.q + '%'); where.push(`(o.order_number ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`) }
  res.json(await loadOrders(where.join(' AND '), params))
}))

router.patch('/orders/:id', handle(async (req, res) => {
  const { status } = req.body
  if (!isId(req.params.id) || !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const r = await query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND status <> $1 RETURNING id', [status, req.params.id])
  if (r.rows.length) await query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)', [req.params.id, status, req.user.id])
  const [order] = await loadOrders('o.id = $1', [req.params.id])
  res.json(order)
}))

// ---------- Vehicles ----------
router.get('/vehicles', handle(async (req, res) => {
  const { rows } = await query(`
    SELECT v.*, b.name AS brand,
           (SELECT count(*) FROM part_fitment f WHERE f.vehicle_id = v.id)::int AS fit_count
    FROM vehicles v JOIN brands b ON b.id = v.brand_id
    ORDER BY b.name, v.model_name`)
  res.json(rows)
}))

router.post('/vehicles', handle(async (req, res) => {
  const { brand, modelName, category, bodyType, drivetrain, basePrice, model3dUrl, modelSourceUrl } = req.body
  if (!String(brand || '').trim() || !String(modelName || '').trim()) return res.status(400).json({ error: 'Brand and model are required' })
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a category' })
  if (!DRIVES.includes(drivetrain)) return res.status(400).json({ error: 'Choose a drivetrain' })
  if (!(Number(basePrice) > 0)) return res.status(400).json({ error: 'Enter a base price' })

  const b = await query('INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [brand.trim()])
  let slug = slugify(`${brand} ${modelName}`)
  const taken = await query('SELECT 1 FROM vehicles WHERE slug = $1', [slug])
  if (taken.rows.length) slug += '-' + Date.now().toString(36)
  const embed = toSketchfabEmbed(model3dUrl)
  const source = modelSourceUrl || (embed && embed.includes('sketchfab') && model3dUrl !== embed ? model3dUrl : null)

  const { rows } = await query(`
    INSERT INTO vehicles (brand_id, model_name, slug, category, body_type, drivetrain, base_price, model_3d_url, model_source_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [b.rows[0].id, modelName.trim(), slug, category, String(bodyType || 'Coupe').trim(), drivetrain, Number(basePrice), embed, source])
  for (let i = 0; i < DEFAULT_PAINTS.length; i++) {
    const [name, hex, price] = DEFAULT_PAINTS[i]
    await query('INSERT INTO paint_options (vehicle_id, name, hex_color, price, sort_order) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, name, hex, price, i])
  }
  res.status(201).json({ id: rows[0].id, slug })
}))

router.patch('/vehicles/:id', handle(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Vehicle not found' })
  const sets = []
  const params = []
  const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`) }
  if (req.body.basePrice !== undefined) {
    if (!(Number(req.body.basePrice) >= 0)) return res.status(400).json({ error: 'Invalid price' })
    set('base_price', Number(req.body.basePrice))
  }
  if (req.body.isActive !== undefined) set('is_active', !!req.body.isActive)
  if (req.body.model3dUrl !== undefined) set('model_3d_url', toSketchfabEmbed(req.body.model3dUrl))
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id)
  await query(`UPDATE vehicles SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params)
  res.json({ ok: true })
}))

// ---------- Parts ----------
router.get('/parts', handle(async (req, res) => {
  const { rows } = await query(`
    SELECT p.*, c.name AS category,
           (SELECT count(*) FROM part_fitment f JOIN vehicles v ON v.id = f.vehicle_id WHERE f.part_id = p.id AND v.is_active)::int AS fit_count,
           (SELECT url FROM part_media m WHERE m.part_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
    FROM parts p JOIN part_categories c ON c.id = p.category_id
    ORDER BY c.name, p.name`)
  res.json(rows)
}))

router.post('/parts', handle(async (req, res) => {
  const { name, category, partBrand, price, stock, isVisual, imageUrl, material, finish } = req.body
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name is required' })
  if (!(Number(price) > 0)) return res.status(400).json({ error: 'Enter a price' })
  const cat = await query('SELECT id FROM part_categories WHERE name = $1', [category])
  if (!cat.rows.length) return res.status(400).json({ error: 'Choose a category' })
  const specs = {}
  if (material) specs.material = String(material).trim()
  if (finish) specs.finish = String(finish).trim()
  const { rows } = await query(`
    INSERT INTO parts (category_id, name, part_brand, price, stock, is_visual, specs)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [cat.rows[0].id, name.trim(), String(partBrand || '').trim() || 'Unbranded', Number(price), Math.max(0, Number(stock) || 0), isVisual !== false, specs])
  if (imageUrl) await query('INSERT INTO part_media (part_id, url) VALUES ($1,$2)', [rows[0].id, String(imageUrl).trim()])
  res.status(201).json({ id: rows[0].id })
}))

router.patch('/parts/:id', handle(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Part not found' })
  const sets = []
  const params = []
  const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`) }
  if (req.body.price !== undefined) {
    if (!(Number(req.body.price) >= 0)) return res.status(400).json({ error: 'Invalid price' })
    set('price', Number(req.body.price))
  }
  if (req.body.stock !== undefined) set('stock', Math.max(0, Math.floor(Number(req.body.stock) || 0)))
  if (req.body.isVisual !== undefined) set('is_visual', !!req.body.isVisual)
  if (req.body.isActive !== undefined) set('is_active', !!req.body.isActive)
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id)
  await query(`UPDATE parts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params)
  res.json({ ok: true })
}))

// ---------- Compatibility ----------
router.get('/fitment', handle(async (req, res) => {
  const vehicles = await query(`SELECT v.id, v.model_name, b.name AS brand FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.is_active ORDER BY b.name, v.model_name`)
  const parts = await query(`SELECT p.id, p.name, p.is_active, c.name AS category FROM parts p JOIN part_categories c ON c.id = p.category_id ORDER BY c.name, p.name`)
  const pairs = await query('SELECT part_id, vehicle_id FROM part_fitment')
  res.json({ vehicles: vehicles.rows, parts: parts.rows, pairs: pairs.rows })
}))

router.put('/fitment', handle(async (req, res) => {
  const { partId, vehicleId, fits } = req.body
  if (!isId(partId) || !isId(vehicleId)) return res.status(400).json({ error: 'Invalid part or car' })
  if (fits) await query('INSERT INTO part_fitment (part_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [partId, vehicleId])
  else await query('DELETE FROM part_fitment WHERE part_id = $1 AND vehicle_id = $2', [partId, vehicleId])
  res.json({ ok: true })
}))

// ---------- Part rules ----------
router.get('/rules', handle(async (req, res) => {
  const { rows } = await query(`
    SELECT r.id, r.rule_type, r.part_id, r.related_part_id, a.name AS part_name, b.name AS related_name
    FROM part_rules r JOIN parts a ON a.id = r.part_id JOIN parts b ON b.id = r.related_part_id
    ORDER BY a.name`)
  res.json(rows)
}))

router.post('/rules', handle(async (req, res) => {
  const { partId, relatedPartId, ruleType } = req.body
  if (!isId(partId) || !isId(relatedPartId)) return res.status(400).json({ error: 'Pick two parts' })
  if (partId === relatedPartId) return res.status(400).json({ error: 'Pick two different parts' })
  if (!['requires', 'conflicts'].includes(ruleType)) return res.status(400).json({ error: 'Invalid rule type' })
  const dup = await query('SELECT 1 FROM part_rules WHERE part_id = $1 AND related_part_id = $2', [partId, relatedPartId])
  if (dup.rows.length) return res.status(409).json({ error: 'That rule already exists' })
  await query('INSERT INTO part_rules (part_id, related_part_id, rule_type) VALUES ($1,$2,$3)', [partId, relatedPartId, ruleType])
  res.status(201).json({ ok: true })
}))

router.delete('/rules/:id', handle(async (req, res) => {
  if (isId(req.params.id)) await query('DELETE FROM part_rules WHERE id = $1', [req.params.id])
  res.json({ ok: true })
}))

// ---------- Featured builds (home page carousel) ----------
router.get('/builds', handle(async (req, res) => {
  const builds = await loadBuilds('true', [])
  const users = await query('SELECT id, full_name FROM users')
  const names = Object.fromEntries(users.rows.map((u) => [u.id, u.full_name]))
  res.json(builds.map(({ user_id, ...b }) => ({ ...b, owner: names[user_id] || 'Unknown' })))
}))

router.patch('/builds/:id', handle(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Build not found' })
  await query('UPDATE builds SET is_featured = $1 WHERE id = $2', [!!req.body.isFeatured, req.params.id])
  res.json({ ok: true })
}))

export default router
