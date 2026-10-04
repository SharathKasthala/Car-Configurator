import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Card, Nav, Form, Button, InputGroup, Alert, Row, Col } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'

export default function Login() {
  const { user, login, register } = useAuth()
  const { refresh } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/catalog'

  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const switchTo = (m) => { setMode(m); setError(''); setInfo('') }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'forgot') {
        const res = await api.post('/auth/forgot', { email: form.email })
        setInfo(res.data.message + ' (During development, the link is printed in the server terminal.)')
      } else {
        if (mode === 'register') await register(form.name, form.email, form.password)
        else await login(form.email, form.password)
        await refresh().catch(() => {})
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const titles = { login: 'Welcome back', register: 'Create your account', forgot: 'Reset your password' }

  return (
    <Row className="justify-content-center">
      <Col sm={10} md={7} lg={5}>
        <Card body className="shadow-sm">
          {mode !== 'forgot' && (
            <Nav variant="pills" fill activeKey={mode} onSelect={switchTo} className="mb-3">
              <Nav.Item><Nav.Link eventKey="login">Log in</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="register">Create account</Nav.Link></Nav.Item>
            </Nav>
          )}
          <h1 className="h3 mb-3">{titles[mode]}</h1>
          {location.state?.from && mode !== 'forgot' && <p className="text-body-secondary">Log in to continue.</p>}

          <Form onSubmit={submit} noValidate>
            {mode === 'register' && (
              <Form.Group className="mb-3" controlId="login-name">
                <Form.Label>Full name</Form.Label>
                <Form.Control autoComplete="name" value={form.name} onChange={set('name')} />
              </Form.Group>
            )}
            <Form.Group className="mb-3" controlId="login-email">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" autoComplete="email" value={form.email} onChange={set('email')} />
            </Form.Group>
            {mode !== 'forgot' && (
              <Form.Group className="mb-3" controlId="login-password">
                <div className="d-flex justify-content-between">
                  <Form.Label>Password</Form.Label>
                  {mode === 'login' && <Button variant="link" size="sm" className="p-0 text-warning" onClick={() => switchTo('forgot')}>Forgot password?</Button>}
                </div>
                <InputGroup>
                  <Form.Control type={show ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                value={form.password} onChange={set('password')} />
                  <Button variant="outline-secondary" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</Button>
                </InputGroup>
                {mode === 'register' && <Form.Text>At least 8 characters.</Form.Text>}
              </Form.Group>
            )}

            {error && <Alert variant="danger">{error}</Alert>}
            {info && <Alert variant="success">{info}</Alert>}

            <div className="d-grid gap-2">
              <Button type="submit" variant="warning" size="lg" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Log in'}
              </Button>
              {mode === 'forgot' && <Button variant="link" className="text-warning" onClick={() => switchTo('login')}>Back to log in</Button>}
            </div>
          </Form>
          <p className="small text-body-secondary mt-3 mb-0">Demo customer: demo@carconfig.local / Demo@12345</p>
        </Card>
      </Col>
    </Row>
  )
}
