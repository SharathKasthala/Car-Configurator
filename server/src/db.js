import pg from 'pg'
import 'dotenv/config'

// One shared connection pool for the whole app
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export const query = (text, params) => pool.query(text, params)
export default pool
