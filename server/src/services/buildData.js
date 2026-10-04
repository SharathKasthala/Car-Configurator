import { query } from '../db.js'

// Loads builds with car, paint and parts details plus their total price.
// Pass a WHERE clause on table alias "b" and its params.
export async function loadBuilds(where, params) {
  const { rows } = await query(`
    SELECT b.id, b.name, b.status, b.share_token, b.is_featured, b.updated_at, b.created_at, b.user_id,
           b.vehicle_id, b.paint_option_id, b.paint_finish_id,
           v.slug, v.model_name, v.base_price, v.model_3d_url, br.name AS brand,
           po.name AS paint_name, po.hex_color, COALESCE(po.price, 0) AS paint_price,
           pf.name AS finish_name, COALESCE(pf.price, 0) AS finish_price
    FROM builds b
    JOIN vehicles v ON v.id = b.vehicle_id
    JOIN brands br ON br.id = v.brand_id
    LEFT JOIN paint_options po ON po.id = b.paint_option_id
    LEFT JOIN paint_finishes pf ON pf.id = b.paint_finish_id
    WHERE ${where}
    ORDER BY b.updated_at DESC`, params)
  if (!rows.length) return []

  const ids = rows.map((r) => r.id)
  const parts = await query(`
    SELECT bp.build_id, p.id, p.name, p.price, p.is_visual, p.specs, c.name AS category
    FROM build_parts bp JOIN parts p ON p.id = bp.part_id JOIN part_categories c ON c.id = p.category_id
    WHERE bp.build_id = ANY($1::uuid[]) ORDER BY c.name`, [ids])
  const previews = await query(`
    SELECT id, build_id, angle, image_url, created_at FROM ai_previews
    WHERE build_id = ANY($1::uuid[]) ORDER BY created_at DESC`, [ids])

  return rows.map((b) => {
    const bParts = parts.rows.filter((p) => p.build_id === b.id)
    const total = Number(b.base_price) + Number(b.paint_price) + Number(b.finish_price) +
      bParts.reduce((s, p) => s + Number(p.price), 0)
    return {
      ...b,
      car_name: `${b.brand} ${b.model_name}`,
      parts: bParts.map(({ build_id, ...p }) => ({ ...p, price: Number(p.price) })),
      previews: previews.rows.filter((p) => p.build_id === b.id),
      total,
    }
  })
}