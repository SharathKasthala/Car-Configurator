import { useCallback, useEffect, useState } from 'react'
import { Row, Col, Nav, Card, Table, Badge, Button, Form, InputGroup, Alert, ListGroup, Spinner } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import Modal, { ModalActions } from '../components/Modal.jsx'
import CategoryPills from '../components/CategoryPills.jsx'
import { STATUS_VARIANT } from './Account.jsx'
import { money, date, titleCase } from '../lib/format.js'

const SECTIONS = [
  ['overview', 'Overview', 'How the store is doing at a glance.'],
  ['orders', 'Orders', 'Track and update customer orders.'],
  ['vehicles', 'Vehicles', 'Cars in the catalog, base prices and 3D models.'],
  ['parts', 'Parts', 'Pricing, stock and AI preview visibility.'],
  ['fitment', 'Compatibility', 'Which parts fit which cars, plus part rules.'],
  ['featured', 'Featured builds', 'Choose which builds appear in the home page carousel.'],
]
const Loading = () => <div className="text-center py-4"><Spinner animation="border" /></div>

export default function Admin() {
  const [sec, setSec] = useState('overview')
  const [meta, setMeta] = useState(null)
  const [pending, setPending] = useState(0)
  const current = SECTIONS.find((s) => s[0] === sec)

  useEffect(() => { api.get('/admin/meta').then((r) => setMeta(r.data)) }, [])

  return (
    <Row className="g-4">
      <Col md={3} lg={2}>
        <Nav variant="pills" activeKey={sec} onSelect={setSec} className="flex-nowrap flex-md-column overflow-auto gap-1 sticky-md-top" style={{ top: 80 }}>
          {SECTIONS.map(([id, name]) => (
            <Nav.Item key={id}>
              <Nav.Link eventKey={id} className="d-flex align-items-center gap-2 text-nowrap">
                {name}{id === 'orders' && pending > 0 && <Badge bg="warning" text="dark" pill className="ms-auto">{pending}</Badge>}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      </Col>
      <Col md={9} lg={10}>
        <h1 className="mb-1">{current[1]}</h1>
        <p className="lead text-body-secondary">{current[2]}</p>
        {sec === 'overview' && <Overview go={setSec} onPending={setPending} />}
        {sec === 'orders' && <Orders meta={meta} onPending={setPending} />}
        {sec === 'vehicles' && <Vehicles meta={meta} />}
        {sec === 'parts' && <Parts meta={meta} />}
        {sec === 'fitment' && <Fitment />}
        {sec === 'featured' && <Featured />}
      </Col>
    </Row>
  )
}

const StatusBadge = ({ status }) => <Badge bg={STATUS_VARIANT[status]}>{titleCase(status)}</Badge>

// On/off switch used for Live/Hidden, AI preview and Featured
const Switch = ({ id, on, onLabel, offLabel, onChange }) => (
  <Form.Check type="switch" id={id} checked={on} onChange={onChange} label={on ? onLabel : offLabel} className="mb-0 text-nowrap" />
)

function Overview({ go, onPending }) {
  const [s, setS] = useState(null)
  useEffect(() => { api.get('/admin/stats').then((r) => { setS(r.data); onPending(r.data.pending) }) }, [onPending])
  if (!s) return <Loading />
  return (
    <>
      <Row xs={1} sm={2} xl={4} className="g-3 mb-4">
        {[['Orders', s.orders], ['Revenue', money(s.revenue)], ['Average order', money(s.average)], ['Pending orders', s.pending]].map(([l, v]) => (
          <Col key={l}><Card body><div className="small text-body-secondary">{l}</div><div className="fs-3 fw-bold">{v}</div></Card></Col>
        ))}
      </Row>
      <Row className="g-3">
        <Col xl={8}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <strong>Recent orders</strong>
              <Button variant="link" size="sm" className="link-warning p-0" onClick={() => go('orders')}>View all</Button>
            </Card.Header>
            <Table responsive hover className="mb-0 align-middle">
              <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>{s.recent.map((o) => (
                <tr key={o.id}><td className="fw-semibold">{o.order_number}</td><td>{o.customer}</td><td>{money(o.total)}</td><td><StatusBadge status={o.status} /></td></tr>
              ))}</tbody>
            </Table>
          </Card>
        </Col>
        <Col xl={4}>
          <Card>
            <Card.Header><strong>Low stock</strong></Card.Header>
            <ListGroup variant="flush">
              {s.lowStock.length ? s.lowStock.map((p) => (
                <ListGroup.Item key={p.id} className="d-flex justify-content-between"><span>{p.name}</span><span className="text-warning text-nowrap">{p.stock} left</span></ListGroup.Item>
              )) : <ListGroup.Item className="text-body-secondary">All parts are well stocked.</ListGroup.Item>}
            </ListGroup>
            <Card.Footer><Button variant="link" size="sm" className="link-warning p-0" onClick={() => go('parts')}>Manage parts</Button></Card.Footer>
          </Card>
        </Col>
      </Row>
    </>
  )
}

function Orders({ meta, onPending }) {
  const [orders, setOrders] = useState(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const load = useCallback(() => {
    api.get('/admin/orders', { params: { status: status || undefined, q: q || undefined } }).then((r) => setOrders(r.data))
  }, [status, q])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])

  const change = async (o, value) => {
    const res = await api.patch(`/admin/orders/${o.id}`, { status: value })
    setOrders((all) => all.map((x) => (x.id === o.id ? res.data : x)))
    api.get('/admin/stats').then((r) => onPending(r.data.pending))
  }

  return (
    <>
      <Row className="g-2 mb-3">
        <Col lg={5}><Form.Control type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order, customer or email" aria-label="Search orders" /></Col>
        <Col lg={7}>
          <CategoryPills items={[['', 'All'], ...(meta?.statuses || []).map((s) => [s, titleCase(s)])]} value={status} onChange={setStatus} />
        </Col>
      </Row>
      <Card>
        <Table responsive hover className="mb-0 align-middle">
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(orders || []).map((o) => (
              <tr key={o.id}>
                <td className="fw-semibold">{o.order_number}</td>
                <td>{o.customer}<div className="small text-body-secondary">{o.customer_email}</div></td>
                <td className="text-nowrap">{date(o.created_at)}</td>
                <td>{o.item_count}</td>
                <td className="fw-semibold">{money(o.total)}</td>
                <td>
                  <Form.Select size="sm" value={o.status} onChange={(e) => change(o, e.target.value)} aria-label={`Status for ${o.order_number}`} style={{ minWidth: 130 }}>
                    {(meta?.statuses || []).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </Form.Select>
                </td>
                <td><Button variant="link" size="sm" className="link-warning" onClick={() => setOpen(o)}>Details</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
        {orders && !orders.length && <Card.Body className="text-center text-body-secondary">No orders match.</Card.Body>}
        {!orders && <Loading />}
      </Card>
      {open && (
        <Modal title={`Order ${open.order_number}`} onClose={() => setOpen(null)}>
          <div className="small text-body-secondary">{open.customer} · {open.customer_email} · {date(open.created_at)}</div>
          <div className="small text-body-secondary">Ship to: {Object.values(open.shipping_address).filter(Boolean).join(', ')} · {open.delivery_method}</div>
          <ListGroup variant="flush">
            {open.items.map((i) => <ListGroup.Item key={i.id} className="d-flex justify-content-between px-0"><span>{i.part_name} × {i.quantity}</span><span>{money(i.unit_price * i.quantity)}</span></ListGroup.Item>)}
            <ListGroup.Item className="d-flex justify-content-between px-0 fw-bold"><span>Total</span><span>{money(open.total)}</span></ListGroup.Item>
          </ListGroup>
          <h3 className="h6 mb-0">History</h3>
          {open.history.map((h, k) => <div key={k} className="d-flex justify-content-between small"><StatusBadge status={h.status} /><span className="text-body-secondary">{date(h.created_at)}</span></div>)}
        </Modal>
      )}
    </>
  )
}

// Number box that saves when you click out of it
function SaveOnBlur({ value, onSave, label, step = 1 }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <Form.Control size="sm" type="number" min="0" step={step} aria-label={label} value={v} style={{ width: 110 }}
                  onChange={(e) => setV(e.target.value)} onBlur={() => String(v) !== String(value) && onSave(v)} />
  )
}

function Vehicles({ meta }) {
  const [rows, setRows] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const load = () => api.get('/admin/vehicles').then((r) => setRows(r.data))
  useEffect(() => { load() }, [])
  const patch = async (id, body) => {
    try { await api.patch(`/admin/vehicles/${id}`, body); setError(''); load() } catch (e) { setError(errorText(e)) }
  }
  return (
    <>
      <div className="mb-3"><Button variant="warning" onClick={() => setAdding(true)}>+ Add vehicle</Button></div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <Table responsive hover className="mb-0 align-middle">
          <thead><tr><th>Vehicle</th><th>Category</th><th>Base price ($)</th><th>3D model</th><th>Fits</th><th>Status</th></tr></thead>
          <tbody>{(rows || []).map((v) => (
            <tr key={v.id}>
              <td><div className="fw-semibold">{v.model_name}</div><div className="small text-body-secondary">{v.brand}</div></td>
              <td>{v.category}<div className="small text-body-secondary">{v.body_type} · {v.drivetrain}</div></td>
              <td><SaveOnBlur value={Number(v.base_price)} step={100} label={`Base price for ${v.model_name}`} onSave={(x) => patch(v.id, { basePrice: x })} /></td>
              <td>{v.model_3d_url ? <Badge bg="success">Linked</Badge> : <Badge bg="warning" text="dark">Missing</Badge>}</td>
              <td className="text-nowrap">{v.fit_count} parts</td>
              <td><Switch id={`veh-${v.id}`} on={v.is_active} onLabel="Live" offLabel="Hidden" onChange={() => patch(v.id, { isActive: !v.is_active })} /></td>
            </tr>
          ))}</tbody>
        </Table>
        {!rows && <Loading />}
      </Card>
      {adding && <AddVehicle meta={meta} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </>
  )
}

function AddVehicle({ meta, onClose, onSaved }) {
  const [f, setF] = useState({ brand: '', modelName: '', category: 'Sports', bodyType: 'Coupe', drivetrain: 'RWD', basePrice: '', model3dUrl: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try { await api.post('/admin/vehicles', f); onSaved() } catch (err) { setError(errorText(err)) }
  }
  return (
    <Modal title="Add vehicle" onClose={onClose}>
      <Form onSubmit={save}>
        <Row className="g-3">
          <Col sm={6}><Form.Group controlId="v-brand"><Form.Label>Brand</Form.Label><Form.Control list="brand-list" value={f.brand} onChange={set('brand')} /></Form.Group>
            <datalist id="brand-list">{(meta?.brands || []).map((b) => <option key={b} value={b} />)}</datalist></Col>
          <Col sm={6}><Form.Group controlId="v-model"><Form.Label>Model</Form.Label><Form.Control value={f.modelName} onChange={set('modelName')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="v-cat"><Form.Label>Category</Form.Label><Form.Select value={f.category} onChange={set('category')}>{(meta?.carCategories || []).map((c) => <option key={c}>{c}</option>)}</Form.Select></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="v-body"><Form.Label>Body type</Form.Label><Form.Control value={f.bodyType} onChange={set('bodyType')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="v-drive"><Form.Label>Drivetrain</Form.Label><Form.Select value={f.drivetrain} onChange={set('drivetrain')}>{(meta?.drivetrains || []).map((c) => <option key={c}>{c}</option>)}</Form.Select></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="v-price"><Form.Label>Base price ($)</Form.Label><Form.Control type="number" min="0" value={f.basePrice} onChange={set('basePrice')} /></Form.Group></Col>
          <Col xs={12}><Form.Group controlId="v-model3d"><Form.Label>Sketchfab model link</Form.Label>
            <Form.Control placeholder="https://sketchfab.com/3d-models/..." value={f.model3dUrl} onChange={set('model3dUrl')} />
            <Form.Text>Paste the model page link. It's turned into an embed link automatically. Six standard paint colors are added for you.</Form.Text>
          </Form.Group></Col>
        </Row>
        {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        <div className="mt-3"><ModalActions><Button variant="outline-light" onClick={onClose}>Cancel</Button><Button type="submit" variant="warning">Save vehicle</Button></ModalActions></div>
      </Form>
    </Modal>
  )
}

function Parts({ meta }) {
  const [rows, setRows] = useState(null)
  const [cat, setCat] = useState('All')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const load = () => api.get('/admin/parts').then((r) => setRows(r.data))
  useEffect(() => { load() }, [])
  const patch = async (id, body) => {
    try { await api.patch(`/admin/parts/${id}`, body); setError(''); load() } catch (e) { setError(errorText(e)) }
  }
  const shown = (rows || []).filter((p) => cat === 'All' || p.category === cat)
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <CategoryPills items={['All', ...(meta?.partCategories || [])]} value={cat} onChange={setCat} />
        <Button variant="warning" onClick={() => setAdding(true)}>+ Add part</Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <Table responsive hover className="mb-0 align-middle">
          <thead><tr><th>Part</th><th>Category</th><th>Price ($)</th><th>Stock</th><th>AI preview</th><th>Fits</th><th>Status</th></tr></thead>
          <tbody>{shown.map((p) => (
            <tr key={p.id}>
              <td><div className="fw-semibold">{p.name}</div><div className="small text-body-secondary">{p.part_brand}</div></td>
              <td>{p.category}</td>
              <td><SaveOnBlur value={Number(p.price)} step={5} label={`Price for ${p.name}`} onSave={(x) => patch(p.id, { price: x })} /></td>
              <td>
                <SaveOnBlur value={p.stock} label={`Stock for ${p.name}`} onSave={(x) => patch(p.id, { stock: x })} />
                {p.stock <= 4 && <div className="small text-warning">Low</div>}
              </td>
              <td><Switch id={`vis-${p.id}`} on={p.is_visual} onLabel="Shown" offLabel="Specs only" onChange={() => patch(p.id, { isVisual: !p.is_visual })} /></td>
              <td className="text-nowrap">{p.fit_count} cars</td>
              <td><Switch id={`part-${p.id}`} on={p.is_active} onLabel="Live" offLabel="Hidden" onChange={() => patch(p.id, { isActive: !p.is_active })} /></td>
            </tr>
          ))}</tbody>
        </Table>
        {!rows && <Loading />}
      </Card>
      <p className="small text-body-secondary mt-2">Price and stock save when you click out of the box.</p>
      {adding && <AddPart meta={meta} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </>
  )
}

function AddPart({ meta, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', category: meta?.partCategories?.[0] || 'Wheels', partBrand: '', price: '', stock: '', material: '', finish: '', imageUrl: '', isVisual: true })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try { await api.post('/admin/parts', f); onSaved() } catch (err) { setError(errorText(err)) }
  }
  return (
    <Modal title="Add part" onClose={onClose}>
      <Form onSubmit={save}>
        <Row className="g-3">
          <Col xs={12}><Form.Group controlId="p-name"><Form.Label>Name</Form.Label><Form.Control value={f.name} onChange={set('name')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-cat"><Form.Label>Category</Form.Label><Form.Select value={f.category} onChange={set('category')}>{(meta?.partCategories || []).map((c) => <option key={c}>{c}</option>)}</Form.Select></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-brand"><Form.Label>Brand</Form.Label><Form.Control value={f.partBrand} onChange={set('partBrand')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-price"><Form.Label>Price ($)</Form.Label><Form.Control type="number" min="0" value={f.price} onChange={set('price')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-stock"><Form.Label>Stock</Form.Label><Form.Control type="number" min="0" value={f.stock} onChange={set('stock')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-mat"><Form.Label>Material</Form.Label><Form.Control value={f.material} onChange={set('material')} /></Form.Group></Col>
          <Col sm={6}><Form.Group controlId="p-fin"><Form.Label>Finish</Form.Label><Form.Control value={f.finish} onChange={set('finish')} /></Form.Group></Col>
          <Col xs={12}><Form.Group controlId="p-img"><Form.Label>Photo link (optional)</Form.Label><Form.Control placeholder="https://..." value={f.imageUrl} onChange={set('imageUrl')} /></Form.Group></Col>
          <Col xs={12}><Form.Check type="switch" id="p-visual" label="Visible part (shown in AI preview)" checked={f.isVisual} onChange={() => setF({ ...f, isVisual: !f.isVisual })} /></Col>
        </Row>
        <p className="small text-body-secondary mt-3 mb-0">After saving, set which cars it fits under Compatibility.</p>
        {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        <div className="mt-3"><ModalActions><Button variant="outline-light" onClick={onClose}>Cancel</Button><Button type="submit" variant="warning">Save part</Button></ModalActions></div>
      </Form>
    </Modal>
  )
}

function Fitment() {
  const [data, setData] = useState(null)
  const [rules, setRules] = useState([])
  const [rule, setRule] = useState({ partId: '', ruleType: 'requires', relatedPartId: '' })
  const [error, setError] = useState('')

  const load = () => {
    api.get('/admin/fitment').then((r) => {
      setData({ ...r.data, set: new Set(r.data.pairs.map((p) => `${p.part_id}|${p.vehicle_id}`)) })
      setRule((x) => x.partId ? x : { ...x, partId: r.data.parts[0]?.id || '', relatedPartId: r.data.parts[1]?.id || '' })
    })
    api.get('/admin/rules').then((r) => setRules(r.data))
  }
  useEffect(() => { load() }, [])

  const toggle = async (partId, vehicleId) => {
    const key = `${partId}|${vehicleId}`
    const fits = !data.set.has(key)
    const next = new Set(data.set); fits ? next.add(key) : next.delete(key)
    setData({ ...data, set: next })
    try { await api.put('/admin/fitment', { partId, vehicleId, fits }) } catch (e) { setError(errorText(e)); load() }
  }
  const addRule = async () => {
    try { await api.post('/admin/rules', rule); setError(''); load() } catch (e) { setError(errorText(e)) }
  }
  const delRule = async (id) => { await api.delete(`/admin/rules/${id}`); load() }

  if (!data) return <Loading />
  return (
    <>
      <Card className="mb-4">
        <Table responsive hover className="mb-0 align-middle">
          <thead><tr><th>Part</th>{data.vehicles.map((v) => <th key={v.id} className="text-center small">{v.brand}<br />{v.model_name}</th>)}</tr></thead>
          <tbody>{data.parts.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'opacity-50'}>
              <td><div className="fw-semibold">{p.name}</div><div className="small text-body-secondary">{p.category}</div></td>
              {data.vehicles.map((v) => (
                <td key={v.id} className="text-center">
                  <Form.Check className="d-inline-block mb-0" aria-label={`${p.name} fits ${v.brand} ${v.model_name}`}
                              checked={data.set.has(`${p.id}|${v.id}`)} onChange={() => toggle(p.id, v.id)} />
                </td>
              ))}
            </tr>
          ))}</tbody>
        </Table>
      </Card>

      <Card>
        <Card.Header><strong>Part rules</strong></Card.Header>
        <Card.Body>
          <p className="small text-body-secondary">"Requires" locks a part until the other is chosen. "Conflicts with" stops both being picked together.</p>
          <ListGroup className="mb-3">
            {rules.map((r) => (
              <ListGroup.Item key={r.id} className="d-flex flex-wrap align-items-center gap-2">
                <strong>{r.part_name}</strong>
                <Badge bg={r.rule_type === 'requires' ? 'primary' : 'danger'}>{r.rule_type === 'requires' ? 'requires' : 'conflicts with'}</Badge>
                <strong>{r.related_name}</strong>
                <Button variant="link" size="sm" className="link-danger ms-auto" onClick={() => delRule(r.id)}>Remove</Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <InputGroup className="flex-wrap">
            <Form.Select aria-label="First part" value={rule.partId} onChange={(e) => setRule({ ...rule, partId: e.target.value })}>
              {data.parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Form.Select>
            <Form.Select aria-label="Rule type" value={rule.ruleType} onChange={(e) => setRule({ ...rule, ruleType: e.target.value })} style={{ maxWidth: 170 }}>
              <option value="requires">requires</option><option value="conflicts">conflicts with</option>
            </Form.Select>
            <Form.Select aria-label="Second part" value={rule.relatedPartId} onChange={(e) => setRule({ ...rule, relatedPartId: e.target.value })}>
              {data.parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Form.Select>
            <Button variant="warning" onClick={addRule}>Add rule</Button>
          </InputGroup>
          {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        </Card.Body>
      </Card>
    </>
  )
}

function Featured() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = () => api.get('/admin/builds').then((r) => setRows(r.data)).catch((e) => setError(errorText(e)))
  useEffect(() => { load() }, [])
  const toggle = async (b) => {
    try { await api.patch(`/admin/builds/${b.id}`, { isFeatured: !b.is_featured }); setError(''); load() } catch (e) { setError(errorText(e)) }
  }
  const count = (rows || []).filter((b) => b.is_featured).length
  return (
    <>
      <p className="small text-body-secondary">{count} featured. The home page shows up to 6.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <Table responsive hover className="mb-0 align-middle">
          <thead><tr><th>Build</th><th>Car</th><th>Owner</th><th>Total</th><th>Status</th><th>Home page</th></tr></thead>
          <tbody>{(rows || []).map((b) => (
            <tr key={b.id}>
              <td><div className="fw-semibold">{b.name}</div><div className="small text-body-secondary">{b.parts.length} parts · {b.paint_name}</div></td>
              <td>{b.car_name}</td>
              <td>{b.owner}</td>
              <td>{money(b.total)}</td>
              <td>{titleCase(b.status)}</td>
              <td><Switch id={`feat-${b.id}`} on={b.is_featured} onLabel="Featured" offLabel="Not featured" onChange={() => toggle(b)} /></td>
            </tr>
          ))}</tbody>
        </Table>
        {rows && !rows.length && <Card.Body className="text-center text-body-secondary">No builds yet.</Card.Body>}
        {!rows && !error && <Loading />}
      </Card>
    </>
  )
}
