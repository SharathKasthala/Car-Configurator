import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Row, Col, Form, Button, Card, InputGroup, Alert, Ratio, Table } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import ItemCard from '../components/ItemCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FilterPanel, { FilterGroup } from '../components/FilterPanel.jsx'
import CategoryPills from '../components/CategoryPills.jsx'
import Modal from '../components/Modal.jsx'
import { money } from '../lib/format.js'

const PRICES = [
  { id: 'any', name: 'Any price' },
  { id: 'u500', name: 'Under $500', min: 0, max: 500 },
  { id: '500-2000', name: '$500 to $2,000', min: 500, max: 2000 },
  { id: 'o2000', name: 'Over $2,000', min: 2000 },
]
const VIS = [
  { id: 'all', name: 'All parts' },
  { id: 'visual', name: 'Shown in AI preview' },
  { id: 'hidden', name: 'Hidden parts (specs only)' },
]

export default function Marketplace() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { addPart, cart } = useCart()

  const [cars, setCars] = useState([])
  const [meta, setMeta] = useState({ categories: [], brands: [] })
  const [vehicle, setVehicle] = useState(params.get('vehicle') || '')
  const [fitOnly, setFitOnly] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState(params.get('category') || 'All')
  const [brands, setBrands] = useState([])
  const [price, setPrice] = useState('any')
  const [visual, setVisual] = useState('all')
  const [sort, setSort] = useState('pop')
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [compare, setCompare] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    api.get('/vehicles').then((r) => {
      setCars(r.data)
      if (!vehicle && r.data.length) setVehicle(r.data[0].slug)
    })
    api.get('/parts/meta').then((r) => setMeta(r.data))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload parts whenever a filter changes (search waits until typing pauses)
  useEffect(() => {
    if (!vehicle) return
    const pr = PRICES.find((p) => p.id === price)
    const t = setTimeout(() => {
      setLoading(true)
      api.get('/parts', {
        params: {
          vehicle, fitOnly: fitOnly ? 1 : 0, q: q || undefined, category,
          brands: brands.length ? brands.join(',') : undefined,
          min: pr.min, max: pr.max, visual, sort,
        },
      }).then((r) => setParts(r.data)).finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [vehicle, fitOnly, q, category, brands, price, visual, sort])

  const carName = useMemo(() => {
    const c = cars.find((x) => x.slug === vehicle)
    return c ? `${c.brand} ${c.model_name}` : ''
  }, [cars, vehicle])
  const inCart = (id) => cart?.items.some((i) => i.part_id === id)
  const compareParts = compare.map((id) => parts.find((p) => p.id === id)).filter(Boolean)

  const toggleCompare = (id) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c)
  const reset = () => { setQ(''); setCategory('All'); setBrands([]); setPrice('any'); setVisual('all'); setFitOnly(true) }

  const add = async (part) => {
    if (!user) return navigate('/login', { state: { from: location.pathname + location.search } })
    try {
      await addPart(part.id)
      setNotice({ ok: true, text: `${part.name} added to your cart.` })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    }
  }

  return (
    <>
      <h1 className="mb-1">Parts marketplace</h1>
      <p className="lead text-body-secondary">Search, compare and add aftermarket parts. Pick your car to see only what fits.</p>

      <Card body className="mb-3">
        <Row className="g-2 align-items-center">
          <Col md>
            <InputGroup>
              <InputGroup.Text>Shopping for</InputGroup.Text>
              <Form.Select value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Choose your car" className="fw-semibold">
                {cars.map((c) => <option key={c.slug} value={c.slug}>{c.brand} {c.model_name}</option>)}
              </Form.Select>
            </InputGroup>
          </Col>
          <Col md="auto">
            <Form.Check type="switch" id="fit-only" label="Only show parts that fit my car" checked={fitOnly} onChange={() => setFitOnly(!fitOnly)} />
          </Col>
        </Row>
      </Card>

      <Row className="g-2 align-items-center mb-3">
        <Col md>
          <Form.Control type="search" size="lg" value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="Search parts, e.g. coilovers, carbon wing" aria-label="Search parts" />
        </Col>
        <Col md="auto">
          <InputGroup>
            <InputGroup.Text>Sort</InputGroup.Text>
            <Form.Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort parts">
              <option value="pop">Most popular</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </Form.Select>
          </InputGroup>
        </Col>
      </Row>

      <div className="mb-3">
        <CategoryPills items={['All', ...meta.categories]} value={category} onChange={setCategory}>
          <Button variant="outline-light" className="rounded-pill d-md-none ms-auto" onClick={() => setShowFilters(true)}>Filters</Button>
        </CategoryPills>
      </div>

      {notice && <Alert variant={notice.ok ? 'success' : 'danger'} dismissible onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <Row className="g-4">
        <Col md={4} lg={3}>
          <FilterPanel show={showFilters} onHide={() => setShowFilters(false)} onReset={reset}>
            <FilterGroup title="Price">
              {PRICES.map((p) => <Form.Check key={p.id} type="radio" name="pprice" id={`pp-${p.id}`} label={p.name} checked={price === p.id} onChange={() => setPrice(p.id)} />)}
            </FilterGroup>
            <FilterGroup title="Parts brand">
              {meta.brands.map((b) => (
                <Form.Check key={b} id={`pb-${b}`} label={b} checked={brands.includes(b)}
                            onChange={() => setBrands(brands.includes(b) ? brands.filter((x) => x !== b) : [...brands, b])} />
              ))}
            </FilterGroup>
            <FilterGroup title="Visibility">
              {VIS.map((v) => <Form.Check key={v.id} type="radio" name="pvis" id={`pv-${v.id}`} label={v.name} checked={visual === v.id} onChange={() => setVisual(v.id)} />)}
            </FilterGroup>
          </FilterPanel>
        </Col>

        <Col md={8} lg={9} className={compare.length ? 'pb-5' : ''}>
          <p className="text-body-secondary">
            {loading ? 'Loading…' : `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}${fitOnly && carName ? ` that fit the ${carName}` : ''}`}
          </p>
          {!loading && !parts.length && (
            <EmptyState title="No parts match"><Button variant="outline-light" onClick={reset}>Clear all filters</Button></EmptyState>
          )}
          <Row xs={1} sm={2} xl={3} className="g-3">
            {parts.map((p) => (
              <Col key={p.id}>
                <ItemCard
                  art={(
                    <Ratio aspectRatio="4x3">
                      {p.image_url
                        ? <img src={p.image_url} alt="" style={{ objectFit: 'cover' }} />
                        : <div className="d-flex align-items-center justify-content-center small text-body-secondary">Part photo</div>}
                    </Ratio>
                  )}
                  tagLeft={p.category}
                  tagRight={p.is_visual ? 'In AI preview' : 'Specs only'} tagRightVariant={p.is_visual ? 'warning' : 'dark'}
                  dim={p.fits === false} selected={compare.includes(p.id)}
                >
                  <div>
                    <div className="small text-body-secondary">{p.part_brand}</div>
                    <h3 className="h6 mb-0">{p.name}</h3>
                  </div>
                  {p.fits === false
                    ? <span className="small text-warning">Does not fit {carName}</span>
                    : <span className="small text-success">✓ Fits {carName}</span>}
                  {p.stock <= 3 && <span className="small text-warning">{p.stock ? `Only ${p.stock} left` : 'Sold out'}</span>}
                  <div className="d-flex justify-content-between align-items-center mt-auto pt-1">
                    <strong>{money(p.price)}</strong>
                    <Form.Check id={`cmp-${p.id}`} label="Compare" className="small mb-0" checked={compare.includes(p.id)}
                                disabled={!compare.includes(p.id) && compare.length >= 3} onChange={() => toggleCompare(p.id)} />
                  </div>
                  <Button variant={inCart(p.id) ? 'outline-light' : 'warning'} disabled={p.fits === false || p.stock < 1} onClick={() => add(p)}>
                    {p.fits === false ? 'Not compatible' : p.stock < 1 ? 'Sold out' : inCart(p.id) ? 'In cart · add another' : 'Add to cart'}
                  </Button>
                </ItemCard>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      {compare.length > 0 && (
        <div className="compare-tray">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <strong>Compare ({compare.length} of 3)</strong>
            {compareParts.map((p) => <span key={p.id} className="badge bg-secondary fw-normal">{p.name}</span>)}
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-light" onClick={() => setCompare([])}>Clear</Button>
            <Button variant="warning" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare now</Button>
          </div>
        </div>
      )}

      {showCompare && (
        <Modal title="Compare parts" onClose={() => setShowCompare(false)} wide>
          <Table responsive className="align-middle mb-0">
            <tbody>
              {[
                ['Part', (p) => <strong>{p.name}</strong>],
                ['Category', (p) => p.category],
                ['Brand', (p) => p.part_brand],
                ['Price', (p) => <strong>{money(p.price)}</strong>],
                ['Material', (p) => p.specs?.material || '—'],
                ['Finish', (p) => p.specs?.finish || '—'],
                ['Size', (p) => p.specs?.size || '—'],
                [`Fits ${carName}`, (p) => (p.fits === false ? 'No' : 'Yes')],
                ['In AI preview', (p) => (p.is_visual ? 'Yes' : 'No, specs only')],
                ['In stock', (p) => p.stock],
              ].map(([label, get]) => (
                <tr key={label}><th className="text-body-secondary fw-normal">{label}</th>{compareParts.map((p) => <td key={p.id}>{get(p)}</td>)}</tr>
              ))}
              <tr><th></th>{compareParts.map((p) => (
                <td key={p.id}><Button variant="outline-warning" size="sm" disabled={p.fits === false || p.stock < 1} onClick={() => add(p)}>Add to cart</Button></td>
              ))}</tr>
            </tbody>
          </Table>
        </Modal>
      )}
    </>
  )
}
