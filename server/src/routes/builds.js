import { Router } from 'express'
import crypto from 'node:crypto'
import pool, { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { priceBuild } from '../services/pricing.js'
import { loadBuilds } from '../services/buildData.js'
import { handle, isId } from '../lib.js'

const router = Router()

// Public: featured builds for the home page carousel
router.get('/featured', handle(async (req, res) => {
  res.json((await loadBuilds('b.is_featured', [])).slice(0, 6))
}))

// Public: a shared build
router.get('/shared/:token', handle(async (req, res) => {
  const [build] = await loadBuilds('b.share_token = $1', [req.params.token])
  if (!build) return res.status(404).json({ error: 'This shared build was not found' })
  const { user_id, ...safe } = build
  res.json(safe)
}))

router.use(requireAuth)

async function ownBuild(req, res) {
  if (!isId(req.params.id)) { res.status(404).json({ error: 'Build not found' }); return null }
  const [build] = await loadBuilds('b.id = $1 AND b.user_id = $2', [req.params.id, req.user.id])
  if (!build) { res.status(404).json({ error: 'Build not found' }); return null }
  return build
}

// My builds
router.get('/', handle(async (req, res) => {
  res.json(await loadBuilds('b.user_id = $1', [req.user.id]))
}))

router.get('/:id', handle(async (req, res) => {
  const build = await ownBuild(req, res)
  if (build) res.json(build)
}))

async function saveParts(client, buildId, partIds) {
  await client.query('DELETE FROM build_parts WHERE build_id = $1', [buildId])
  for (const pid of new Set(partIds)) {
    await client.query('INSERT INTO build_parts (build_id, part_id) VALUES ($1,$2)', [buildId, pid])
  }
}

// Save a new build  { vehicleId, paintOptionId, finishId, partIds, name }
router.post('/', handle(async (req, res) => {
  const { vehicleId, paintOptionId, finishId, partIds = [], name } = req.body
  const check = await priceBuild({ vehicleId, paintOptionId, finishId, partIds })
  if (!check.ok) return res.status(400).json({ error: check.error })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO builds (user_id, vehicle_id, paint_option_id, paint_finish_id, name)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, vehicleId, paintOptionId || null, finishId || null, String(name || 'My build').trim().slice(0, 80) || 'My build'])
    await saveParts(client, rows[0].id, partIds)
    await client.query('COMMIT')
    const [build] = await loadBuilds('b.id = $1', [rows[0].id])
    res.status(201).json(build)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}))

// Update a build: rename, or change its options (drafts only)
router.put('/:id', handle(async (req, res) => {
  const build = await ownBuild(req, res)
  if (!build) return
  const { name, paintOptionId, finishId, partIds } = req.body

  // Check everything before writing anything
  let clean
  if (name !== undefined) {
    clean = String(name).trim().slice(0, 80)
    if (!clean) return res.status(400).json({ error: 'Name cannot be empty' })
  }
  if (partIds !== undefined) {
    if (build.status === 'ordered') return res.status(400).json({ error: 'Ordered builds cannot be changed. Duplicate it instead.' })
    const check = await priceBuild({ vehicleId: build.vehicle_id, paintOptionId, finishId, partIds })
    if (!check.ok) return res.status(400).json({ error: check.error })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (clean) await client.query('UPDATE builds SET name = $1, updated_at = now() WHERE id = $2', [clean, build.id])
    if (partIds !== undefined) {
      await client.query('UPDATE builds SET paint_option_id = $1, paint_finish_id = $2, updated_at = now() WHERE id = $3',
        [paintOptionId || null, finishId || null, build.id])
      await saveParts(client, build.id, partIds)
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  const [updated] = await loadBuilds('b.id = $1', [build.id])
  res.json(updated)
}))

router.post('/:id/duplicate', handle(async (req, res) => {
  const build = await ownBuild(req, res)
  if (!build) return
  const { rows } = await query(
    `INSERT INTO builds (user_id, vehicle_id, paint_option_id, paint_finish_id, name)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [req.user.id, build.vehicle_id, build.paint_option_id, build.paint_finish_id, `${build.name} (copy)`.slice(0, 80)])
  for (const p of build.parts) await query('INSERT INTO build_parts VALUES ($1,$2)', [rows[0].id, p.id])
  const [copy] = await loadBuilds('b.id = $1', [rows[0].id])
  res.status(201).json(copy)
}))

router.delete('/:id', handle(async (req, res) => {
  const build = await ownBuild(req, res)
  if (!build) return
  await query('DELETE FROM builds WHERE id = $1', [build.id])
  res.json({ ok: true })
}))

router.post('/:id/share', handle(async (req, res) => {
  const build = await ownBuild(req, res)
  if (!build) return
  let token = build.share_token
  if (!token) {
    token = crypto.randomBytes(9).toString('base64url')
    await query('UPDATE builds SET share_token = $1 WHERE id = $2', [token, build.id])
  }
  res.json({ token, url: `${process.env.CLIENT_URL}/shared/${token}` })
}))

export default router