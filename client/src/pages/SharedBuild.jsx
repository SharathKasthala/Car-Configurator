import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Row, Col, Card, Button, ListGroup, Spinner } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import BuildImage from '../components/BuildImage.jsx'
import CarViewer from '../components/CarViewer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { money } from '../lib/format.js'

export default function SharedBuild() {
  const { token } = useParams()
  const [build, setBuild] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/builds/shared/${token}`).then((r) => setBuild(r.data)).catch((e) => setError(errorText(e)))
  }, [token])

  if (error) return <EmptyState title={error}><Button as={Link} to="/catalog" variant="warning">Browse cars</Button></EmptyState>
  if (!build) return <div className="text-center py-5"><Spinner animation="border" /></div>

  return (
    <>
      <div className="small text-body-secondary">Shared build</div>
      <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
        <h1 className="mb-0">{build.name}</h1>
        <strong className="fs-3">{money(build.total)}</strong>
      </div>
      <p className="lead text-body-secondary">{build.car_name} · {build.paint_name}{build.finish_name ? `, ${build.finish_name}` : ''}</p>

      <Row className="g-4">
        <Col lg={8}><Card body><BuildImage build={build} /></Card></Col>
        <Col lg={4}>
          <Card>
            <Card.Header as="h2" className="h5">Parts</Card.Header>
            <ListGroup variant="flush">
              {build.parts.length ? build.parts.map((p) => (
                <ListGroup.Item key={p.id} className="d-flex justify-content-between"><span>{p.name}</span><span>{money(p.price)}</span></ListGroup.Item>
              )) : <ListGroup.Item className="text-body-secondary">Stock parts</ListGroup.Item>}
            </ListGroup>
            <Card.Body className="d-grid">
              <Button as={Link} to={`/configure/${build.slug}`} variant="warning">Build your own {build.model_name}</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h2 className="h4 mt-5 mb-3">The stock car in 3D</h2>
      <CarViewer modelUrl={build.model_3d_url} title={build.car_name} />
    </>
  )
}
