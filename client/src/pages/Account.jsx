import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Row, Col, Badge, ListGroup, Alert, Spinner, Button } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { money, date, titleCase } from '../lib/format.js'

const STEPS = ['pending', 'processing', 'shipped', 'delivered']
export const STATUS_VARIANT = { pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'secondary' }

export default function Account() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/orders').then((r) => setOrders(r.data)).catch((e) => setError(errorText(e))) }, [])

  return (
    <>
      <h1 className="mb-3">My account</h1>
      <Card body className="mb-4">
        <Row className="g-3">
          <Col sm><div className="small text-body-secondary">Name</div><strong>{user.name}</strong></Col>
          <Col sm><div className="small text-body-secondary">Email</div><strong>{user.email}</strong></Col>
          <Col sm><div className="small text-body-secondary">Account type</div><strong>{titleCase(user.role)}</strong></Col>
        </Row>
      </Card>

      <h2 className="h4 mb-3">My orders</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {!orders ? <div className="text-center py-4"><Spinner animation="border" /></div> : !orders.length ? (
        <Card body className="text-center">
          <p className="text-body-secondary">No orders yet.</p>
          <Button as={Link} to="/parts" variant="warning">Shop parts</Button>
        </Card>
      ) : orders.map((o) => {
        const reached = STEPS.indexOf(o.status)
        return (
          <Card key={o.id} className="mb-3">
            <Card.Header className="d-flex flex-wrap align-items-center gap-2">
              <div className="me-auto">
                <strong>Order {o.order_number}</strong>
                <div className="small text-body-secondary">{date(o.created_at)}{o.build_name ? ` · ${o.build_name}` : ''}</div>
              </div>
              <Badge bg={STATUS_VARIANT[o.status]}>{titleCase(o.status)}</Badge>
              <strong>{money(o.total)}</strong>
            </Card.Header>
            <Card.Body>
              {o.status === 'cancelled' ? <p className="text-body-secondary">This order was cancelled.</p> : (
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {STEPS.map((s, k) => {
                    const when = o.history.find((h) => h.status === s)
                    return (
                      <Badge key={s} bg={k <= reached ? 'success' : 'secondary'} className="fw-normal p-2" text={k <= reached ? undefined : 'light'}>
                        {k <= reached ? '✓ ' : ''}{titleCase(s)}{when ? ` · ${date(when.created_at)}` : ''}
                      </Badge>
                    )
                  })}
                </div>
              )}
              <ListGroup variant="flush">
                {o.items.map((i) => (
                  <ListGroup.Item key={i.id} className="d-flex justify-content-between px-0">
                    <span>{i.part_name} × {i.quantity}</span><span>{money(i.unit_price * i.quantity)}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        )
      })}
    </>
  )
}
