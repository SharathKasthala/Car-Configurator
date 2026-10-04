import { Router } from 'express'
import pool, { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { cartTotals, DELIVERY } from '../services/totals.js'
import { handle, isId } from '../lib.js'

const router = Router()
router.use(requireAuth)

const ADDRESS_FIELDS = ['firstName', 'lastName', 'email', 'street', 'city', 'state', 'zip']

export async function loadOrders(where, params) {
  const { rows } = await query(`
    SELECT o.*, u.full_name AS customer, u.email AS customer_email, b.name AS build_name, v.model_name AS car
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN builds b ON b.id = o.build_id
    LEFT JOIN vehicles v ON v.id = b.vehicle_id
    WHERE ${where}
    ORDER BY o.created_at DESC`, params)
  if (!rows.length) return []
  const ids = rows.map((o) => o.id)
  const items = await query('SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])', [ids])
  const history = await query('SELECT order_id, status, created_at FROM order_status_history WHERE order_id = ANY($1::uuid[]) ORDER BY created_at', [ids])
  return rows.map((o) => {
    const its = items.rows.filter((i) => i.order_id === o.id)
    return {
      ...o,
      items: its,
      item_count: its.reduce((s, i) => s + i.quantity, 0),
      history: history.rows.filter((h) => h.order_id === o.id),
    }
  })
}

router.get('/', handle(async (req, res) => {
  res.json(await loadOrders('o.user_id = $1', [req.user.id]))
}))

router.get('/:id', handle(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Order not found' })
  const [order] = await loadOrders('o.id = $1 AND o.user_id = $2', [req.params.id, req.user.id])
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json(order)
}))

// Place an order from the cart  { address: {...}, deliveryMethod, payment: { cardName, cardNumber, exp, cvc } }
// Payment is a mock: nothing is charged.
router.post('/', handle(async (req, res) => {
  const address = req.body.address || {}
  const payment = req.body.payment || {}
  const deliveryMethod = DELIVERY[req.body.deliveryMethod] ? req.body.deliveryMethod : null
  const missing = ADDRESS_FIELDS.filter((f) => !String(address[f] || '').trim())
  if (missing.length) return res.status(400).json({ error: 'Please fill in the full shipping address' })
  if (!deliveryMethod) return res.status(400).json({ error: 'Choose a delivery option' })
  const digits = String(payment.cardNumber || '').replace(/\D/g, '')
  if (!payment.cardName || digits.length < 12 || !payment.exp || !payment.cvc) {
    return res.status(400).json({ error: 'Please fill in the card details' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cart = await client.query(`
      SELECT c.id, pc.code, pc.percent_off FROM carts c
      LEFT JOIN promo_codes pc ON pc.code = c.promo_code AND pc.is_active AND (pc.expires_at IS NULL OR pc.expires_at > now())
      WHERE c.user_id = $1`, [req.user.id])
    if (!cart.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Your cart is empty' }) }
    const cartId = cart.rows[0].id

    // Lock the parts so two orders can't sell the same stock
    const items = await client.query(`
      SELECT ci.quantity, ci.build_id, p.id AS part_id, p.name, p.price, p.stock, p.is_active
      FROM cart_items ci JOIN parts p ON p.id = ci.part_id
      WHERE ci.cart_id = $1 FOR UPDATE OF p`, [cartId])
    if (!items.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Your cart is empty' }) }
    const short = items.rows.find((i) => !i.is_active || i.stock < i.quantity)
    if (short) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `Only ${Math.max(0, short.stock)} left of ${short.name}. Please update your cart.` })
    }

    const promo = cart.rows[0].percent_off ? { percent_off: cart.rows[0].percent_off } : null
    const t = cartTotals(items.rows, promo, deliveryMethod)
    const buildIds = [...new Set(items.rows.map((i) => i.build_id).filter(Boolean))]

    const next = await client.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '\\D', '', 'g'), '')::int), 1000) + 1 AS n FROM orders`)
    const orderNumber = `#${next.rows[0].n}`
    const shippingAddress = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, String(address[f]).trim()]))

    const order = await client.query(`
      INSERT INTO orders (order_number, user_id, build_id, promo_code, delivery_method, shipping_address,
                          subtotal, discount, shipping, tax, total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [orderNumber, req.user.id, buildIds[0] || null, promo ? cart.rows[0].code : null, deliveryMethod, shippingAddress,
        t.subtotal, t.discount, t.shipping, t.tax, t.total])
    const orderId = order.rows[0].id

    for (const i of items.rows) {
      await client.query('INSERT INTO order_items (order_id, part_id, part_name, unit_price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [orderId, i.part_id, i.name, i.price, i.quantity])
      await client.query('UPDATE parts SET stock = stock - $1, updated_at = now() WHERE id = $2', [i.quantity, i.part_id])
    }
    await client.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'pending')`, [orderId])
    await client.query(`INSERT INTO payments (order_id, provider, provider_ref, status, amount) VALUES ($1,'mock',$2,'paid',$3)`,
      [orderId, `mock_${digits.slice(-4)}`, t.total])
    if (buildIds.length) {
      await client.query(`UPDATE builds SET status = 'ordered', updated_at = now() WHERE id = ANY($1::uuid[]) AND user_id = $2`, [buildIds, req.user.id])
    }
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId])
    await client.query('UPDATE carts SET promo_code = NULL WHERE id = $1', [cartId])
    await client.query('COMMIT')

    const [saved] = await loadOrders('o.id = $1', [orderId])
    res.status(201).json(saved)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}))

export default router
