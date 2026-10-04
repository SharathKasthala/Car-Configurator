import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { query } from '../db.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { handle } from '../lib.js'

const router = Router()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const publicUser = (u) => ({ id: u.id, name: u.full_name, email: u.email, role: u.role })

// POST /api/auth/register  { name, email, password }
router.post('/register', handle(async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!name) return res.status(400).json({ error: 'Enter your name' })
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email])
  if (exists.rows.length) return res.status(409).json({ error: 'An account with this email already exists' })

  const hash = await bcrypt.hash(password, 10)
  const { rows } = await query(
    'INSERT INTO users (full_name, email, password_hash) VALUES ($1,$2,$3) RETURNING *', [name, email, hash])
  res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) })
}))

// POST /api/auth/login  { email, password }
router.post('/login', handle(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
  const user = rows[0]
  const ok = user && user.password_hash && (await bcrypt.compare(password, user.password_hash))
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect' })
  res.json({ token: signToken(user), user: publicUser(user) })
}))

// GET /api/auth/me
router.get('/me', requireAuth, handle(async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id])
  if (!rows.length) return res.status(401).json({ error: 'Please log in' })
  res.json(publicUser(rows[0]))
}))

// POST /api/auth/forgot  { email }
// No email service yet: the reset link is printed in the server terminal.
router.post('/forgot', handle(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email])
  if (rows.length) {
    const token = crypto.randomBytes(24).toString('hex')
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    await query(
      `INSERT INTO auth_tokens (user_id, token_hash, type, expires_at) VALUES ($1,$2,'password_reset', now() + interval '1 hour')`,
      [rows[0].id, hash])
    console.log(`\nPassword reset link for ${email}:\n${process.env.CLIENT_URL}/reset-password?token=${token}\n`)
  }
  // Same answer either way, so nobody can check which emails are registered
  res.json({ message: 'If that email has an account, a reset link has been sent.' })
}))

// POST /api/auth/reset  { token, password }
router.post('/reset', handle(async (req, res) => {
  const token = String(req.body.token || '')
  const password = String(req.body.password || '')
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const { rows } = await query(
    `SELECT id, user_id FROM auth_tokens
     WHERE token_hash = $1 AND type = 'password_reset' AND used_at IS NULL AND expires_at > now()`, [hash])
  if (!rows.length) return res.status(400).json({ error: 'This reset link is invalid or has expired' })
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(password, 10), rows[0].user_id])
  await query('UPDATE auth_tokens SET used_at = now() WHERE id = $1', [rows[0].id])
  res.json({ message: 'Password updated. You can log in now.' })
}))

export default router