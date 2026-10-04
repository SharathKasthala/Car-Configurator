import bcrypt from 'bcryptjs'
import pool from '../db.js'

// Fills the database with sample data.
// WARNING: this empties every table first, so only use it in development.

const sketchfab = (id) => `https://sketchfab.com/models/${id}/embed`

const brands = ['Chevrolet', 'BMW', 'Mazda', 'Toyota', 'Audi', 'McLaren']

// Sample prices for demo use only
const vehicles = [
  { slug: 'chevrolet-corvette-c7', brand: 'Chevrolet', model: 'Corvette C7', drive: 'RWD', price: 59995, featured: true,
    sf: '2b509d1bce104224b147c81757f6f43a', page: 'https://sketchfab.com/3d-models/chevrolet-corvette-c7-2b509d1bce104224b147c81757f6f43a' },
  { slug: 'bmw-m3-e46', brand: 'BMW', model: 'M3 E46', drive: 'RWD', price: 38500,
    sf: '74916396475b414f8dbcb580621a5010', page: 'https://sketchfab.com/3d-models/bmw-e46-m3-sports-car-red-74916396475b414f8dbcb580621a5010' },
  { slug: 'mazda-rx-7', brand: 'Mazda', model: 'RX-7', drive: 'RWD', price: 42000,
    sf: 'd9f736f66ee24544bec4326ee9b135b9', page: 'https://sketchfab.com/3d-models/mazda-rx-7-d9f736f66ee24544bec4326ee9b135b9' },
  { slug: 'toyota-supra', brand: 'Toyota', model: 'Supra', drive: 'RWD', price: 56250,
    sf: '41b83cfb912b4eab9af19a802bcf5ffc', page: 'https://sketchfab.com/3d-models/toyota-supra-3d-model-free-41b83cfb912b4eab9af19a802bcf5ffc' },
  { slug: 'bmw-m3-e30', brand: 'BMW', model: 'M3 E30', drive: 'RWD', price: 65000,
    sf: 'ac3c7013434e403e8faff87948caf422', page: 'https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422' },
  { slug: 'audi-r8', brand: 'Audi', model: 'R8', drive: 'AWD', price: 158600,
    sf: '34bec7c5b99d4db28f05e1ba967f1b24', page: 'https://sketchfab.com/3d-models/audi-r8-free-34bec7c5b99d4db28f05e1ba967f1b24' },
  { slug: 'mclaren-p1-mso', brand: 'McLaren', model: 'P1 MSO', drive: 'RWD', price: 1150000,
    sf: 'c7687064e08c4be9a0af88e98bcf0a8e', page: 'https://sketchfab.com/3d-models/free-mclaren-p1-mso-c7687064e08c4be9a0af88e98bcf0a8e' },
]

const paints = [
  ['Graphite grey', '#4A4F55', 0],
  ['Obsidian black', '#1A1C1F', 0],
  ['Arctic white', '#E6E7E9', 0],
  ['Racing red', '#B3261E', 500],
  ['Deep ocean blue', '#24427A', 500],
  ['Forest green', '#2F4A3A', 500],
]

const finishes = [['Gloss', 0], ['Metallic', 700], ['Matte', 1500]]

const categories = ['Wheels', 'Exhaust', 'Brakes', 'Suspension', 'Air filters', 'Spoilers', 'Body kits', 'Performance']

// fits: list of vehicle slugs, or 'all'
const ALL = 'all'
const parts = [
  { key: 'forged19', cat: 'Wheels', name: 'Forged 19-inch multi-spoke wheels (set of 4)', brand: 'Apex Forged', price: 2400, stock: 12, visual: true,
    specs: { material: 'Forged aluminum', finish: 'Brushed silver', size: '19 in' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'audi-r8', 'bmw-m3-e46'] },
  { key: 'satin19', cat: 'Wheels', name: 'Satin black 19-inch wheels (set of 4)', brand: 'Stealth Wheel Co.', price: 1900, stock: 3, visual: true,
    specs: { material: 'Cast aluminum', finish: 'Satin black', size: '19 in' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'bmw-m3-e46', 'mazda-rx-7'] },
  { key: 'bronze18', cat: 'Wheels', name: 'Bronze 18-inch classic mesh wheels (set of 4)', brand: 'Retro Rim Works', price: 1650, stock: 8, visual: true,
    specs: { material: 'Cast aluminum', finish: 'Matte bronze', size: '18 in' }, fits: ['bmw-m3-e30', 'mazda-rx-7', 'bmw-m3-e46'] },
  { key: 'ti_exhaust', cat: 'Exhaust', name: 'Titanium cat-back exhaust', brand: 'Apex Performance', price: 2600, stock: 5, visual: true,
    specs: { material: 'Titanium', finish: 'Burnt blue tips' }, fits: ['chevrolet-corvette-c7', 'audi-r8', 'mclaren-p1-mso', 'toyota-supra'] },
  { key: 'ss_exhaust', cat: 'Exhaust', name: 'Stainless cat-back exhaust', brand: 'Velocity Pipes', price: 1450, stock: 10, visual: true,
    specs: { material: 'Stainless steel', finish: 'Polished tips' }, fits: ALL },
  { key: 'bbk', cat: 'Brakes', name: 'Big brake kit, 6-piston', brand: 'StopTech Pro', price: 3200, stock: 2, visual: false,
    specs: { material: 'Aluminum calipers', finish: 'Red calipers', pistons: 6 }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'audi-r8', 'bmw-m3-e46'] },
  { key: 'pads', cat: 'Brakes', name: 'Performance brake pads', brand: 'Velocity Pipes', price: 240, stock: 30, visual: false,
    specs: { material: 'Ceramic' }, fits: ALL },
  { key: 'coilovers', cat: 'Suspension', name: 'Adjustable coilover kit', brand: 'RideLine', price: 1850, stock: 9, visual: false,
    specs: { material: 'Steel body', adjustable: true }, fits: ['bmw-m3-e46', 'bmw-m3-e30', 'mazda-rx-7', 'toyota-supra', 'chevrolet-corvette-c7'] },
  { key: 'lowering', cat: 'Suspension', name: 'Lowering springs', brand: 'RideLine', price: 380, stock: 15, visual: true,
    specs: { material: 'Steel', drop: '1.2 in' }, fits: ['bmw-m3-e46', 'bmw-m3-e30', 'mazda-rx-7', 'toyota-supra'] },
  { key: 'filter', cat: 'Air filters', name: 'High-flow air filter', brand: 'AirMax', price: 95, stock: 40, visual: false,
    specs: { material: 'Cotton gauze' }, fits: ALL },
  { key: 'intake', cat: 'Air filters', name: 'Cold air intake system', brand: 'AirMax', price: 420, stock: 6, visual: false,
    specs: { material: 'Aluminum' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'bmw-m3-e46'] },
  { key: 'carbon_wing', cat: 'Spoilers', name: 'Carbon rear wing', brand: 'Aero Carbon', price: 1200, stock: 4, visual: true,
    specs: { material: 'Carbon fiber', finish: 'Gloss carbon' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'mazda-rx-7', 'bmw-m3-e46'] },
  { key: 'ducktail', cat: 'Spoilers', name: 'Ducktail trunk spoiler', brand: 'Aero Carbon', price: 680, stock: 7, visual: true,
    specs: { material: 'ABS plastic', finish: 'Paint to match' }, fits: ['bmw-m3-e46', 'bmw-m3-e30', 'toyota-supra'] },
  { key: 'splitter', cat: 'Body kits', name: 'Front splitter and side skirts', brand: 'Aero Carbon', price: 1450, stock: 7, visual: true,
    specs: { material: 'Polyurethane', finish: 'Matte black' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'mazda-rx-7', 'audi-r8'] },
  { key: 'widebody', cat: 'Body kits', name: 'Widebody fender kit', brand: 'Street Form', price: 3900, stock: 2, visual: true,
    specs: { material: 'Fiberglass', finish: 'Primer' }, fits: ['mazda-rx-7', 'bmw-m3-e46', 'toyota-supra'] },
  { key: 'ecu', cat: 'Performance', name: 'ECU performance tune', brand: 'TuneLab', price: 750, stock: 99, visual: false,
    specs: { type: 'Software' }, fits: ['chevrolet-corvette-c7', 'toyota-supra', 'bmw-m3-e46', 'audi-r8'] },
]

const rules = [
  ['bbk', 'requires', 'forged19'],
  ['carbon_wing', 'conflicts', 'ducktail'],
]

async function seed() {
  const client = await pool.connect()
  const q = (text, params) => client.query(text, params)
  const one = async (text, params) => (await q(text, params)).rows[0]

  try {
    await q('BEGIN')
    await q('ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model_source_url TEXT')

    await q(`TRUNCATE payments, order_status_history, order_items, orders, cart_items, carts,
             promo_codes, ai_previews, build_parts, builds, part_rules, part_fitment, part_media,
             parts, part_categories, paint_finishes, paint_options, vehicle_media, vehicles, brands,
             addresses, auth_tokens, user_identities, users CASCADE`)

    // Users
    const admin = await one(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'admin') RETURNING id`,
      ['Admin', 'admin@carconfig.local', await bcrypt.hash('Admin@12345', 10)])
    const demo = await one(
      `INSERT INTO users (full_name, email, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['Demo Customer', 'demo@carconfig.local', await bcrypt.hash('Demo@12345', 10)])

    // Brands and vehicles
    const brandId = {}
    for (const b of brands) brandId[b] = (await one('INSERT INTO brands (name) VALUES ($1) RETURNING id', [b])).id

    const vehicleId = {}
    for (const v of vehicles) {
      vehicleId[v.slug] = (await one(
        `INSERT INTO vehicles (brand_id, model_name, slug, category, body_type, drivetrain, base_price, model_3d_url, model_source_url)
         VALUES ($1,$2,$3,'Sports','Coupe',$4,$5,$6,$7) RETURNING id`,
        [brandId[v.brand], v.model, v.slug, v.drive, v.price, sketchfab(v.sf), v.page])).id
    }

    // Paint
    const paintId = {}
    for (const v of vehicles) {
      for (let i = 0; i < paints.length; i++) {
        const [name, hex, price] = paints[i]
        const row = await one(
          `INSERT INTO paint_options (vehicle_id, name, hex_color, price, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [vehicleId[v.slug], name, hex, price, i])
        paintId[`${v.slug}:${name}`] = row.id
      }
    }
    const finishId = {}
    for (const [name, price] of finishes) finishId[name] = (await one('INSERT INTO paint_finishes (name, price) VALUES ($1,$2) RETURNING id', [name, price])).id

    // Parts and fitment
    const catId = {}
    for (const c of categories) catId[c] = (await one('INSERT INTO part_categories (name) VALUES ($1) RETURNING id', [c])).id

    const partId = {}
    const partPrice = {}
    for (const p of parts) {
      partId[p.key] = (await one(
        `INSERT INTO parts (category_id, name, part_brand, price, stock, is_visual, specs)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [catId[p.cat], p.name, p.brand, p.price, p.stock, p.visual, p.specs])).id
      partPrice[p.key] = p.price
      const fitSlugs = p.fits === ALL ? vehicles.map((v) => v.slug) : p.fits
      for (const slug of fitSlugs) {
        await q('INSERT INTO part_fitment (part_id, vehicle_id) VALUES ($1,$2)', [partId[p.key], vehicleId[slug]])
      }
    }
    for (const [a, rel, b] of rules) {
      await q('INSERT INTO part_rules (part_id, related_part_id, rule_type) VALUES ($1,$2,$3)', [partId[a], partId[b], rel])
    }

    // Promo
    await q(`INSERT INTO promo_codes (code, percent_off) VALUES ('BUILD10', 10)`)

    // Demo builds
    const b1 = await one(
      `INSERT INTO builds (user_id, vehicle_id, paint_option_id, paint_finish_id, name, is_featured)
       VALUES ($1,$2,$3,$4,'Weekend street build', true) RETURNING id`,
      [demo.id, vehicleId['chevrolet-corvette-c7'], paintId['chevrolet-corvette-c7:Racing red'], finishId.Gloss])
    for (const k of ['satin19', 'carbon_wing', 'ti_exhaust']) await q('INSERT INTO build_parts VALUES ($1,$2)', [b1.id, partId[k]])

    const b2 = await one(
      `INSERT INTO builds (user_id, vehicle_id, paint_option_id, paint_finish_id, name, status)
       VALUES ($1,$2,$3,$4,'Classic E30 restomod','ordered') RETURNING id`,
      [demo.id, vehicleId['bmw-m3-e30'], paintId['bmw-m3-e30:Arctic white'], finishId.Metallic])
    for (const k of ['bronze18', 'coilovers', 'filter']) await q('INSERT INTO build_parts VALUES ($1,$2)', [b2.id, partId[k]])

    // Demo cart (from build 1)
    const cart = await one('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [demo.id])
    for (const k of ['satin19', 'carbon_wing']) {
      await q('INSERT INTO cart_items (cart_id, part_id, build_id, quantity) VALUES ($1,$2,$3,1)', [cart.id, partId[k], b1.id])
    }

    // Demo order (from build 2)
    const items = [['bronze18', 1], ['coilovers', 1], ['filter', 1]]
    const subtotal = items.reduce((sum, [k, qty]) => sum + partPrice[k] * qty, 0)
    const tax = Math.round(subtotal * 0.07 * 100) / 100
    const total = subtotal + tax
    const order = await one(
      `INSERT INTO orders (order_number, user_id, build_id, status, delivery_method, shipping_address, subtotal, shipping, tax, total)
       VALUES ('#1001',$1,$2,'shipped','standard',$3,$4,0,$5,$6) RETURNING id`,
      [demo.id, b2.id, { name: 'Demo Customer', street: '123 Sample St', city: 'Indianapolis', state: 'IN', zip: '46204' }, subtotal, tax, total])
    for (const [k, qty] of items) {
      const p = parts.find((x) => x.key === k)
      await q('INSERT INTO order_items (order_id, part_id, part_name, unit_price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [order.id, partId[k], p.name, p.price, qty])
    }
    for (const st of ['pending', 'processing', 'shipped']) {
      await q('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)', [order.id, st, admin.id])
    }
    await q(`INSERT INTO payments (order_id, provider, status, amount) VALUES ($1,'mock','paid',$2)`, [order.id, total])

    await q('COMMIT')
    console.log('Sample data added.')
    console.log(`  ${vehicles.length} cars, ${parts.length} parts, 2 builds, 1 order`)
    console.log('  Admin login:    admin@carconfig.local / Admin@12345')
    console.log('  Customer login: demo@carconfig.local / Demo@12345')
  } catch (err) {
    await q('ROLLBACK')
    console.error('Seed failed:', err.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

seed()