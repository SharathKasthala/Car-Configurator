import jwt from 'jsonwebtoken'

// Reads "Authorization: Bearer <token>" and puts the user on req.user
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      req.user = null
    }
  }
  next()
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Please log in' })
    next()
  })
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
    next()
  })
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.full_name, email: user.email },
    process.env.JWT_SECRET, { expiresIn: '7d' })
}