import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Form, Button, ButtonGroup, InputGroup, Alert, Spinner, Stack } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { money } from '../lib/format.js'

const STEPS = ['Cart', 'Shipping', 'Payment', 'Done']
const TITLES = ['Your cart', 'Shipping', 'Payment', 'Thank you']
// [field, label, autocomplete, full width, placeholder]
const SHIP_FIELDS = [
  ['firstName', 'First name', 'given-name'], ['lastName', 'Last name', 'family-name'],
  ['email', 'Email', 'email', true], ['street', 'Street address', 'street-address', true],
  ['city', 'City', 'address-level2'], ['state', 'State', 'address-level1'], ['zip', 'ZIP code', 'postal-code'],
]
// Mock checkout: autocomplete is off so the browser doesn't treat these as real card fields
const PAY_FIELDS = [
  ['cardName', 'Name on card', 'off', true, ''], ['cardNumber', 'Card number', 'off', true, '4242 4242 4242 4242'],
  ['exp', 'Expiry', 'off', false, 'MM / YY'], ['cvc', 'Security code', 'off', false, '123'],
]

export default function Cart() {
  const { user } = useAuth()
  const { cart, refresh, setQty, remove, applyPromo, removePromo } = useCart()
  const [step, setStep] = useState(0)
  const [delivery, setDelivery] = useState('standard')
  const [promo, setPromo] = useState('')
  const [promoMsg, setPromoMsg] = useState(null)
  const [ship, setShip] = useState(() => {
    const [first, ...rest] = (user?.name || '').split(' ')
    return { firstName: first || '', lastName: rest.join(' '), email: user?.email || '', street: '', city: '', state: '', zip: '' }
  })
  const [pay, setPay] = useState({ cardName: '', cardNumber: '', exp: '', cvc: '' })
  const [tried, setTried] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState(null)

  // Totals depend on the delivery option, so ask the server again when it changes
  useEffect(() => { refresh(delivery).catch(() => {}) }, [delivery, refresh])

  if (!cart && !order) return <div className="text-center py-5"><Spinner animation="border" /></div>

  const items = order ? order.items.map((i) => ({ id: i.id, name: i.part_name, price: Number(i.unit_price), quantity: i.quantity })) : cart.items
  const totals = order
    ? { subtotal: +order.subtotal, discount: +order.discount, shipping: +order.shipping, tax: +order.tax, total: +order.total }
    : cart.totals
  const count = items.reduce((s, i) => s + i.quantity, 0)
  const missing = (obj, fields) => fields.some(([k]) => !String(obj[k]).trim())

  const next = async () => {
    setError('')
    if (step === 0) { if (count) setStep(1); return }
    if (step === 1) {
      if (missing(ship, SHIP_FIELDS)) { setTried(true); return }
      setTried(false); setStep(2); return
    }
    if (missing(pay, PAY_FIELDS)) { setTried(true); return }
    setBusy(true)
    try {
      const res = await api.post('/orders', { address: ship, deliveryMethod: delivery, payment: pay })
      setOrder(res.data)
      setStep(3)
      refresh().catch(() => {})
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const doPromo = async () => {
    try { await applyPromo(promo); setPromoMsg({ ok: true, text: 'Code applied.' }) }
    catch (err) { setPromoMsg({ ok: false, text: errorText(err) }) }
  }

  const fields = (defs, obj, setObj) => (
    <Row className="g-3">
      {defs.map(([k, label, auto, wide, ph]) => {
        const bad = tried && !String(obj[k]).trim()
        return (
          <Col key={k} sm={wide ? 12 : 6} md={wide ? 12 : 4}>
            <Form.Group controlId={`f-${k}`}>
              <Form.Label>{label}</Form.Label>
              <Form.Control autoComplete={auto} placeholder={ph || ''} value={obj[k]} isInvalid={bad}
                            onChange={(e) => setObj({ ...obj, [k]: e.target.value })} />
              <Form.Control.Feedback type="invalid">Required</Form.Control.Feedback>
            </Form.Group>
          </Col>
        )
      })}
    </Row>
  )

  const line = (label, value, cls = 'text-body-secondary') => (
    <div className={`d-flex justify-content-between small ${cls}`}><span>{label}</span><span>{value}</span></div>
  )

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <h1 className="mb-0">{TITLES[step]}</h1>
        <ol className="stepper" aria-label="Checkout steps">
          {STEPS.map((s, k) => (
            <li key={s} className={k === step ? 'on' : k < step ? 'done' : ''}>
              <span className="step-dot">{k < step ? '✓' : k + 1}</span><span className="step-label">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="position-relative">
        <Row className={'g-4' + (step === 3 ? ' checkout-blurred' : '')} aria-hidden={step === 3}>
          <Col lg={8}>
            {(step === 0 || step === 3) && (
              items.length ? (
                <Stack gap={2}>
                  {items.map((i) => (
                    <Card key={i.id}>
                      <Card.Body className="d-flex flex-wrap align-items-center gap-3">
                        <div className="part-thumb">{i.image_url ? <img src={i.image_url} alt="" /> : 'Photo'}</div>
                        <div className="flex-grow-1" style={{ minWidth: 180 }}>
                          <div className="fw-semibold">{i.name}</div>
                          {i.category && <div className="small text-body-secondary">{i.category} · {i.part_brand}{i.build_name ? ` · for ${i.build_name}` : ''}</div>}
                          {i.stock !== undefined && i.stock < i.quantity && <div className="small text-warning">Only {i.stock} left</div>}
                        </div>
                        {step === 0 ? (
                          <Stack direction="horizontal" gap={3} className="ms-auto">
                            <ButtonGroup aria-label={`Quantity of ${i.name}`}>
                              <Button variant="outline-light" aria-label={`Decrease ${i.name}`} onClick={() => setQty(i.id, i.quantity - 1)} disabled={i.quantity <= 1}>−</Button>
                              <Button variant="outline-light" disabled className="px-3" aria-live="polite">{i.quantity}</Button>
                              <Button variant="outline-light" aria-label={`Increase ${i.name}`} onClick={() => setQty(i.id, i.quantity + 1)} disabled={i.quantity >= 4}>+</Button>
                            </ButtonGroup>
                            <strong style={{ minWidth: 80 }} className="text-end">{money(i.price * i.quantity)}</strong>
                            <Button variant="outline-light" size="sm" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}>✕</Button>
                          </Stack>
                        ) : <strong className="ms-auto">{money(i.price * i.quantity)}</strong>}
                      </Card.Body>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <EmptyState title="Your cart is empty" text="Add parts from the marketplace or from one of your builds.">
                  <Button as={Link} to="/parts" variant="warning">Shop parts</Button>
                </EmptyState>
              )
            )}

            {step === 1 && (
              <Card body>
                <h2 className="h5 mb-3">Shipping address</h2>
                {fields(SHIP_FIELDS, ship, setShip)}
                <h2 className="h5 mt-4 mb-3">Delivery</h2>
                <Stack gap={2}>
                  {Object.entries(cart.delivery).map(([id, d]) => (
                    <label key={id} htmlFor={`del-${id}`} className={`d-flex align-items-center gap-3 border rounded-3 p-3${delivery === id ? ' border-warning' : ''}`} style={{ cursor: 'pointer' }}>
                      <Form.Check type="radio" name="delivery" id={`del-${id}`} checked={delivery === id} onChange={() => setDelivery(id)} className="mb-0" />
                      <span className="flex-grow-1"><strong>{d.name}</strong><span className="d-block small text-body-secondary">{d.desc}</span></span>
                      <span>{id === 'standard' ? `Free over ${money(cart.freeShippingFrom)}` : d.price ? money(d.price) : 'Free'}</span>
                    </label>
                  ))}
                </Stack>
              </Card>
            )}

            {step === 2 && (
              <Card body>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 className="h5 mb-0">Payment</h2>
                  <span className="small text-body-secondary">🔒 Mock checkout, no real payment</span>
                </div>
                {fields(PAY_FIELDS, pay, setPay)}
                <div className="small text-body-secondary mt-3">
                  <strong>Shipping to:</strong> {ship.firstName} {ship.lastName}, {ship.street}, {ship.city}, {ship.state} {ship.zip} · {cart.delivery[delivery].name}{' '}
                  <Button variant="link" size="sm" className="link-warning p-0 align-baseline" onClick={() => setStep(1)}>Change</Button>
                </div>
              </Card>
            )}
          </Col>

          <Col lg={4}>
            <Card>
              <Card.Body className="d-flex flex-column gap-2">
                <h2 className="h5 mb-1">Order summary</h2>
                {line(`Subtotal (${count} item${count === 1 ? '' : 's'})`, money(totals.subtotal))}
                {totals.discount > 0 && line(`Promo ${cart?.promo?.code || ''}`, `−${money(totals.discount)}`, 'text-success')}
                {line('Shipping', totals.shipping ? money(totals.shipping) : 'Free')}
                {line('Estimated tax', money(totals.tax))}
                <div className="d-flex justify-content-between border-top pt-2 fs-4 fw-bold"><span>Total</span><span>{money(totals.total)}</span></div>

                {step === 0 && cart && (
                  cart.promo ? (
                    <div className="d-flex justify-content-between align-items-center small text-success">
                      <span>Code {cart.promo.code} applied</span>
                      <Button variant="link" size="sm" className="link-warning p-0" onClick={removePromo}>Remove</Button>
                    </div>
                  ) : (
                    <Form.Group controlId="promo">
                      <Form.Label className="small text-body-secondary mb-1">Promo code</Form.Label>
                      <InputGroup>
                        <Form.Control value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Try BUILD10" />
                        <Button variant="outline-light" onClick={doPromo} disabled={!promo.trim()}>Apply</Button>
                      </InputGroup>
                      {promoMsg && <Form.Text className={promoMsg.ok ? 'text-success' : 'text-danger'}>{promoMsg.text}</Form.Text>}
                    </Form.Group>
                  )
                )}

                {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
                {step < 3 && (
                  <Button variant="warning" size="lg" onClick={next} disabled={busy || (step === 0 && !count)}>
                    {busy ? 'Placing order…' : step === 0 ? 'Checkout' : step === 1 ? 'Continue to payment' : `Place order · ${money(totals.total)}`}
                  </Button>
                )}
                {(step === 1 || step === 2) && <Button variant="outline-light" onClick={() => setStep(step - 1)}>Back</Button>}
                <div className="small text-body-secondary">Sample tax rate of {Math.round((cart?.taxRate || 0.07) * 100)}%.</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {step === 3 && order && (
          <div className="done-overlay">
            <Card className="done-card shadow-lg" role="status">
              <Card.Body className="d-flex flex-column align-items-center text-center gap-3 p-4 p-md-5">
                <div className="done-icon">✓</div>
                <h2 className="mb-0">Order placed</h2>
                <p className="text-body-secondary mb-0">Order {order.order_number} is confirmed. A receipt is on its way to {ship.email}.</p>
                <div className="w-100 border-top border-bottom py-3 d-flex flex-column gap-2">
                  {line('Items', count, '')}
                  {line('Delivery', cart?.delivery?.[order.delivery_method]?.name || order.delivery_method, '')}
                  <div className="d-flex justify-content-between fw-bold fs-5"><span>Total paid</span><span>{money(order.total)}</span></div>
                </div>
                <Stack direction="horizontal" gap={2} className="w-100">
                  <Button as={Link} to="/account" variant="warning" className="flex-fill">Track my order</Button>
                  <Button as={Link} to="/parts" variant="outline-light" className="flex-fill">Keep shopping</Button>
                </Stack>
              </Card.Body>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
