import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Button, Card, Carousel, Badge, Stack } from 'react-bootstrap'
import api from '../api/client.js'
import BuildImage from '../components/BuildImage.jsx'
import { money } from '../lib/format.js'

const CATEGORIES = ['Sports', 'Off-road', 'SUV', 'Sedan', 'Electric']
const UPGRADES = ['Wheels', 'Exhaust', 'Spoilers', 'Body kits', 'Brakes', 'Suspension', 'Air filters', 'Performance']
const STEPS = [
  ['01', 'Pick a car', 'Search the catalog and explore any model in the 3D viewer from every angle.'],
  ['02', 'Choose your parts', 'Paint, wheels, body kits, exhausts and performance upgrades. Only parts that fit are shown.'],
  ['03', 'See your build', 'Save your build, share it with friends, or add the parts to your cart.'],
]

export default function Home() {
  const [featured, setFeatured] = useState([])

  useEffect(() => { api.get('/builds/featured').then((r) => setFeatured(r.data)).catch(() => {}) }, [])

  return (
    <>
      <Row className="align-items-center g-4 py-lg-4">
        <Col lg={5}>
          <div className="text-warning text-uppercase small fw-semibold mb-2" style={{ letterSpacing: '0.14em' }}>Build it before you buy it</div>
          <h1 className="display-4 fw-bold mb-3">Design your dream car, part by part.</h1>
          <p className="lead text-body-secondary mb-4">
            Explore cars in 3D, pick wheels, body kits, exhausts and performance upgrades that fit, and see the price update as you go.
          </p>
          <Stack direction="horizontal" gap={2} className="flex-wrap">
            <Button as={Link} to="/catalog" variant="warning" size="lg">Start building</Button>
            <Button as={Link} to="/parts" variant="outline-light" size="lg">Shop parts</Button>
          </Stack>
        </Col>

        <Col lg={7}>
          <Card className="shadow">
            <Card.Body>
              {featured.length ? (
                <Carousel interval={5000} pause="hover" indicators={featured.length > 1} controls={featured.length > 1}
                          variant="light" aria-label="Featured builds">
                  {featured.map((b, k) => (
                    <Carousel.Item key={b.id}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="small text-body-secondary">Featured build {k + 1} of {featured.length}</div>
                          <h2 className="h4 mb-0">{b.name}</h2>
                        </div>
                        <strong>{money(b.total)}</strong>
                      </div>
                      <BuildImage build={b} />
                      <div className="d-flex flex-wrap gap-1 my-3">
                        <Badge bg="secondary" className="fw-normal">{b.car_name}</Badge>
                        <Badge bg="secondary" className="fw-normal">{b.paint_name}</Badge>
                        {b.parts.filter((p) => p.is_visual).slice(0, 3).map((p) => (
                          <Badge key={p.id} bg="secondary" className="fw-normal">{p.name}</Badge>
                        ))}
                      </div>
                      {/* Bottom padding leaves room for the carousel dots */}
                      <div className="pb-4">
                        <Button as={Link} to={`/configure/${b.slug}`} variant="outline-warning" size="sm">Customize this car</Button>
                      </div>
                    </Carousel.Item>
                  ))}
                </Carousel>
              ) : (
                <p className="text-body-secondary mb-0">Featured builds appear here. Admins choose them under Admin → Featured builds.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <section className="mt-5">
        <div className="d-flex justify-content-between align-items-baseline mb-3">
          <h2 className="h3 mb-0">Shop by category</h2>
          <Link to="/catalog" className="link-warning">View all cars</Link>
        </div>
        <Row xs={2} sm={3} lg={5} className="g-3">
          {CATEGORIES.map((c) => (
            <Col key={c}>
              <Card as={Link} to={`/catalog?category=${encodeURIComponent(c)}`} className="h-100 text-decoration-none">
                <Card.Body className="d-flex align-items-end" style={{ minHeight: 110 }}>
                  <Card.Title className="mb-0">{c}</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="mt-5">
        <h2 className="h3 mb-3">How it works</h2>
        <Row xs={1} md={3} className="g-3">
          {STEPS.map(([n, t, d]) => (
            <Col key={n}>
              <Card body className="h-100">
                <div className="display-6 fw-bold text-warning">{n}</div>
                <Card.Title>{t}</Card.Title>
                <Card.Text className="text-body-secondary">{d}</Card.Text>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="mt-5">
        <div className="d-flex justify-content-between align-items-baseline mb-3">
          <h2 className="h3 mb-0">Popular upgrades</h2>
          <Link to="/parts" className="link-warning">Browse the marketplace</Link>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {UPGRADES.map((u) => (
            <Button key={u} as={Link} to={`/parts?category=${encodeURIComponent(u)}`} variant="outline-secondary" className="rounded-pill">{u}</Button>
          ))}
        </div>
      </section>
    </>
  )
}
