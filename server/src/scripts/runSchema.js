import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from '../db.js'

// Runs db/schema.sql against DATABASE_URL to create all tables
const here = path.dirname(fileURLToPath(import.meta.url))
const sql = fs.readFileSync(path.join(here, '../../../db/schema.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('All tables created.')
} catch (err) {
  console.error('Schema failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
