import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Row, Col, Form, Button, Badge, Alert, InputGroup } from 'react-bootstrap'
import api from '../api/client.js'
import CarArt from '../components/CarArt.jsx'
import ItemCard from '../components/ItemCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FilterPanel, { FilterGroup } from '../components/FilterPanel.jsx'
import CategoryPills from '../components/CategoryPills.jsx'
import { money } from '../lib/format.js'

const CATEGORIES = ['All', 'Sports', 'Off-road', 'SUV', 'Sedan', 'Electric']
const PRICES = [
  { id: 'any', name: 'Any price', min: 0, max: Infinity },
  { id: 'u50', name: 'Under $50,000', min: 0, max: 50000 },
  { id: '50-100', name: '$50,000 to $100,000', min: 50000, max: 100000 },
  { id: 'o100', name: 'Over $100,000', min: 100000, max: Infinity },
]

export default function Catalog() {
  const [params] = useSearchParams()
  const [cars, setCars] = useState([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(params.get('category') || 'All')
  const [brands, setBrands] = useState([])
  const [drives, setDrives] = useState([])
  const [price, setPrice] = useState('any')
  const [sort, setSort] = useState('az')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    api.get('/vehicles').then((r) => setCars(r.data)).catch(() => setError('Could not load cars. Is the server running?'))
  }, [])

  const allBrands = useMemo(() => [...new Set(cars.map((c) => c.brand))].sort(), [cars])
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const shown = useMemo(() => {
    const pr = PRICES.find((p) => p.id === price)
    const term = q.trim().toLowerCase()
    const list = cars.filter((c) =>
      (cat === 'All' || c.category === cat) &&
      (!brands.length || brands.includes(c.brand)) &&
      (!drives.length || drives.includes(c.drivetrain)) &&
      Number(c.base_price) >= pr.min && Number(c.base_price) < pr.max &&
      (!term || `${c.brand} ${c.model_name} ${c.category} ${c.body_type}`.toLowerCase().includes(term)))
    const sorters = {
      az: (a, b) => `${a.brand} ${a.model_name}`.localeCompare(`${b.brand} ${b.model_name}`),
      low: (a, b) => a.base_price - b.base_price,
      high: (a, b) => b.base_price - a.base_price,
      parts: (a, b) => b.part_count - a.part_count,
    }
    return list.sort(sorters[sort])
  }, [cars, cat, brands, drives, price, q, sort])

  const reset = () => { setQ(''); setCat('All'); setBrands([]); setDrives([]); setPrice('any') }

  return (
    <>
      <h1 className="mb-1">Find your car</h1>
      <p className="lead text-body-secondary">Pick a car to start building. Every model opens in the configurator with parts that fit it.</p>

      <Row className="g-2 align-items-center mb-3">
        <Col md>
          <Form.Control type="search" size="lg" value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by model, brand or type" aria-label="Search cars" />
        </Col>
        <Col md="auto">
          <InputGroup>
            <InputGroup.Text>Sort</InputGroup.Text>
            <Form.Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort cars">
              <option value="az">Name: A to Z</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
              <option value="parts">Most parts available</option>
            </Form.Select>
          </InputGroup>
        </Col>
      </Row>

      <div className="mb-4">
        <CategoryPills items={CATEGORIES} value={cat} onChange={setCat}>
          <Button variant="outline-light" className="rounded-pill d-md-none ms-auto" onClick={() => setShowFilters(true)}>Filters</Button>
        </CategoryPills>
      </div>

      <Row className="g-4">
        <Col md={4} lg={3}>
          <FilterPanel show={showFilters} onHide={() => setShowFilters(false)} onReset={reset}>
            <FilterGroup title="Brand">
              {allBrands.map((b) => (
                <Form.Check key={b} id={`brand-${b}`} label={b} checked={brands.includes(b)} onChange={() => toggle(brands, setBrands, b)} />
              ))}
            </FilterGroup>
            <FilterGroup title="Starting price">
              {PRICES.map((p) => (
                <Form.Check key={p.id} type="radio" name="price" id={`price-${p.id}`} label={p.name} checked={price === p.id} onChange={() => setPrice(p.id)} />
              ))}
            </FilterGroup>
            <FilterGroup title="Drivetrain">
              {['AWD', 'RWD', 'FWD', '4WD'].map((d) => (
                <Form.Check key={d} id={`drive-${d}`} label={d} checked={drives.includes(d)} onChange={() => toggle(drives, setDrives, d)} />
              ))}
            </FilterGroup>
          </FilterPanel>
        </Col>

        <Col md={8} lg={9}>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-body-secondary">{shown.length} {shown.length === 1 ? 'car' : 'cars'}</p>
          {shown.length ? (
            <Row xs={1} sm={2} xl={3} className="g-3">
              {shown.map((car) => (
                <Col key={car.id}>
                  <ItemCard art={<div className="px-3 pt-4 pb-2"><CarArt /></div>}
                            tagLeft={car.category} tagRight="3D" tagRightVariant="warning">
                    <div>
                      <div className="small text-body-secondary">{car.brand}</div>
                      <h3 className="h5 mb-0">{car.model_name}</h3>
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      <Badge bg="secondary" className="fw-normal">{car.body_type}</Badge>
                      <Badge bg="secondary" className="fw-normal">{car.drivetrain}</Badge>
                      <Badge bg="secondary" className="fw-normal">{car.part_count} parts</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                      <span><span className="small text-body-secondary">From </span><strong>{money(car.base_price)}</strong></span>
                      <Button as={Link} to={`/configure/${car.slug}`} variant="warning">Customize</Button>
                    </div>
                  </ItemCard>
                </Col>
              ))}
            </Row>
          ) : !error && (
            <EmptyState title="No cars match these filters">
              <Button variant="outline-light" onClick={reset}>Clear all filters</Button>
            </EmptyState>
          )}
        </Col>
      </Row>
    </>
  )
}
