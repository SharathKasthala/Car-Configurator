// Small shared helpers

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isId = (x) => typeof x === 'string' && UUID.test(x)

// Wraps async route handlers so errors become a 500 response
export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
}

export const money = (n) => Math.round(Number(n) * 100) / 100