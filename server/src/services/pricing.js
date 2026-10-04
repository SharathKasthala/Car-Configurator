import { query } from '../db.js'

// Categories where only one part can be chosen at a time
export const SINGLE_CHOICE = ['Wheels', 'Exhaust']

// Checks a build and works out its price on the server.
// Returns { ok: true, ...breakdown } or { ok: false, error }.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (x) => typeof x === 'string' && UUID.test(x)

export async function priceBuild({ vehicleId, paintOptionId, finishId, partIds = [] }) {
  if (!isId(vehicleId)) return { ok: false, error: 'Car not found' }
  if (paintOptionId && !isId(paintOptionId)) return { ok: false, error: 'Paint color not found' }
  if (finishId && !isId(finishId)) return { ok: false, error: 'Paint finish not found' }
  if (!Array.isArray(partIds) || !partIds.every(isId)) return { ok: false, error: 'One or more parts are not available' }
  const ids = [...new Set(partIds)]

  const v = await query('SELECT id, base_price FROM vehicles WHERE id = $1 AND is_active', [vehicleId])
  if (!v.rows.length) return { ok: false, error: 'Car not found' }
  const base = Number(v.rows[0].base_price)

  let paint = 0
  if (paintOptionId) {
    const p = await query('SELECT price FROM paint_options WHERE id = $1 AND vehicle_id = $2', [paintOptionId, vehicleId])
    if (!p.rows.length) return { ok: false, error: 'Paint color not available for this car' }
    paint += Number(p.rows[0].price)
  }
  if (finishId) {
    const f = await query('SELECT price FROM paint_finishes WHERE id = $1', [finishId])
    if (!f.rows.length) return { ok: false, error: 'Paint finish not found' }
    paint += Number(f.rows[0].price)
  }

  let parts = []
  if (ids.length) {
    const r = await query(`
      SELECT p.id, p.name, p.price, c.name AS category,
             EXISTS (SELECT 1 FROM part_fitment f WHERE f.part_id = p.id AND f.vehicle_id = $2) AS fits
      FROM parts p JOIN part_categories c ON c.id = p.category_id
      WHERE p.id = ANY($1::uuid[]) AND p.is_active`, [ids, vehicleId])
    parts = r.rows
    if (parts.length !== ids.length) return { ok: false, error: 'One or more parts are not available' }

    const misfit = parts.find((p) => !p.fits)
    if (misfit) return { ok: false, error: `${misfit.name} does not fit this car` }

    for (const cat of SINGLE_CHOICE) {
      if (parts.filter((p) => p.category === cat).length > 1) return { ok: false, error: `Choose only one ${cat.toLowerCase()} option` }
    }

    const rules = await query(`
      SELECT r.rule_type, a.name AS a_name, b.name AS b_name, r.part_id, r.related_part_id
      FROM part_rules r JOIN parts a ON a.id = r.part_id JOIN parts b ON b.id = r.related_part_id
      WHERE r.part_id = ANY($1::uuid[])`, [ids])
    for (const rule of rules.rows) {
      const hasOther = ids.includes(rule.related_part_id)
      if (rule.rule_type === 'requires' && !hasOther) return { ok: false, error: `${rule.a_name} requires ${rule.b_name}` }
      if (rule.rule_type === 'conflicts' && hasOther) return { ok: false, error: `${rule.a_name} can't be combined with ${rule.b_name}` }
    }
  }

  const partsTotal = parts.reduce((sum, p) => sum + Number(p.price), 0)
  return {
    ok: true,
    base,
    paint,
    parts: partsTotal,
    total: base + paint + partsTotal,
    lines: parts.map((p) => ({ id: p.id, name: p.name, category: p.category, price: Number(p.price) })),
  }
}
