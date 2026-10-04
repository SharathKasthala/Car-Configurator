import { Offcanvas, Card, Button } from 'react-bootstrap'

// Reusable filters: a sidebar on desktop, a slide-out panel on phones
export default function FilterPanel({ show, onHide, onReset, children }) {
  return (
    <Offcanvas show={show} onHide={onHide} responsive="md" placement="start">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Filters</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="d-block">
        <Card body className="w-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">Filters</h2>
            <Button variant="link" size="sm" className="link-warning p-0" onClick={onReset}>Clear all</Button>
          </div>
          {children}
        </Card>
      </Offcanvas.Body>
    </Offcanvas>
  )
}

export function FilterGroup({ title, children }) {
  return (
    <div className="mb-3">
      <h3 className="h6">{title}</h3>
      {children}
    </div>
  )
}
