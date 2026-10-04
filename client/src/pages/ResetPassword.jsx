import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('/auth/reset', { token: params.get('token'), password })
      setMsg(res.data.message)
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Row className="justify-content-center">
      <Col sm={10} md={7} lg={5}>
        <Card body className="shadow-sm">
          <h1 className="h3 mb-3">Choose a new password</h1>
          {msg ? (
            <>
              <Alert variant="success">{msg}</Alert>
              <div className="d-grid"><Button as={Link} to="/login" variant="warning">Go to log in</Button></div>
            </>
          ) : (
            <Form onSubmit={submit}>
              <Form.Group className="mb-3" controlId="new-password">
                <Form.Label>New password</Form.Label>
                <Form.Control type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Form.Text>At least 8 characters.</Form.Text>
              </Form.Group>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="d-grid"><Button type="submit" variant="warning">Update password</Button></div>
            </Form>
          )}
        </Card>
      </Col>
    </Row>
  )
}
