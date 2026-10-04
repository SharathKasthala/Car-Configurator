import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { cartTotals, DELIVERY, FREE_SHIPPING_FROM, TAX_RATE } from '../services/totals.js'
import { handle, isId } from '../lib.js'

const router = Router()
router.use(requireAuth)

async function getCartId(userId) {
  const found = await query('SELECT id FROM carts WHERE user_id = $1', [userId])
  if (found.rows.length) return found.rows[0].id
  const made = await query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id', [userId])
  return made.rows[0].id
}

export async function readCart(userId, deliveryMethod = 'standard') {
  const cartId = await getCartId(userId)
  const cart = await query(`
    SELECT c.id, c.promo_code, pc.percent_off
    FROM carts c LEFT JOIN promo_codes pc ON pc.code = c.promo_code AND pc.is_active AND (pc.expires_at IS NULL OR pc.expires_at > now())
    WHERE c.id = $1`, [cartId])
  const items = await query(`
    SELECT ci.id, ci.quantity, ci.build_id, p.id AS part_id, p.name, p.part_brand, p.price, p.stock, p.is_active,
           c.name AS category, b.name AS build_name, v.model_name AS build_car,
           (SELECT url FROM part_media m WHERE m.part_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
    FROM cart_items ci
    JOIN parts p ON p.id = ci.part_id
    JOIN part_categories c ON c.id = p.category_id
    LEFT JOIN builds b ON b.id = ci.build_id
    LEFT JOIN vehicles v ON v.id = b.vehicle_id
    WHERE ci.cart_id = $1
    ORDER BY ci.id`, [cartId])
  const row = cart.rows[0]
  const promo = row.percent_off ? { code: row.promo_code, percent_off: row.percent_off } : null
  const list = items.rows.map((i) => ({ ...i, price: Number(i.price) }))
  return {
    id: cartId,
    items: list,
    count: list.reduce((s, i) => s + i.quantity, 0),
    promo,
    totals: cartTotals(list, promo, deliveryMethod),
    delivery: DELIVERY,
    freeShippingFrom: FREE_SHIPPING_FROM,
    taxRate: TAX_RATE,
  }
}

router.get('/', handle(async (req, res) => {
  const method = DELIVERY[req.query.delivery] ? req.query.delivery : 'standard'
  res.json(await readCart(req.user.id, method))
}))

async function addItem(cartId, partId, quantity, buildId) {
  await query(`
    INSERT INTO cart_items (cart_id, part_id, build_id, quantity) VALUES ($1,$2,$3,$4)
    ON CONFLICT (cart_id, part_id) DO UPDATE SET quantity = LEAST(4, cart_items.quantity + EXCLUDED.quantity),
      build_id = COALESCE(EXCLUDED.build_id, cart_items.build_id)`,
    [cartId, partId, buildId || null, quantity])
}

// Add one part  { partId, quantity, buildId }
router.post('/items', handle(async (req, res) => {
  const { partId, buildId } = req.body
  const quantity = Math.max(1, Math.min(4, Number(req.body.quantity) || 1))
  if (!isId(partId)) return res.status(400).json({ error: 'Part not found' })
  const part = await query('SELECT stock FROM parts WHERE id = $1 AND is_active', [partId])
  if (!part.rows.length) return res.status(404).json({ error: 'Part not found' })
  if (part.rows[0].stock < 1) return res.status(400).json({ error: 'This part is sold out' })
  await addItem(await getCartId(req.user.id), partId, quantity, isId(buildId) ? buildId : null)
  res.json(await readCart(req.user.id))
}))

// Add every part from one of my builds
router.post('/from-build/:buildId', handle(async (req, res) => {
  if (!isId(req.params.buildId)) return res.status(404).json({ error: 'Build not found' })
  const build = await query('SELECT id FROM builds WHERE id = $1 AND user_id = $2', [req.params.buildId, req.user.id])
  if (!build.rows.length) return res.status(404).json({ error: 'Build not found' })
  const parts = await query(`
    SELECT p.id FROM build_parts bp JOIN parts p ON p.id = bp.part_id
    WHERE bp.build_id = $1 AND p.is_active AND p.stock > 0`, [req.params.buildId])
  if (!parts.rows.length) return res.status(400).json({ error: 'This build has no parts to add' })
  const cartId = await getCartId(req.user.id)
  for (const p of parts.rows) await addItem(cartId, p.id, 1, req.params.buildId)
  res.json(await readCart(req.user.id))
}))

router.patch('/items/:id', handle(async (req, res) => {
  const quantity = Math.max(1, Math.min(4, Number(req.body.quantity) || 1))
  const cartId = await getCartId(req.user.id)
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Item not found' })
  await query('UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3', [quantity, req.params.id, cartId])
  res.json(await readCart(req.user.id))
}))

router.delete('/items/:id', handle(async (req, res) => {
  const cartId = await getCartId(req.user.id)
  if (isId(req.params.id)) await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.id, cartId])
  res.json(await readCart(req.user.id))
}))

router.post('/promo', handle(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase()
  const found = await query(
    'SELECT code FROM promo_codes WHERE code = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())', [code])
  if (!found.rows.length) return res.status(400).json({ error: 'That code is not valid' })
  await query('UPDATE carts SET promo_code = $1, updated_at = now() WHERE user_id = $2', [code, req.user.id])
  res.json(await readCart(req.user.id))
}))

router.delete('/promo', handle(async (req, res) => {
  await query('UPDATE carts SET promo_code = NULL WHERE user_id = $1', [req.user.id])
  res.json(await readCart(req.user.id))
}))

export default router
