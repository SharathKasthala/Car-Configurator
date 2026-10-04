import { Card, Button, Badge, Alert, Stack } from 'react-bootstrap'
import { money } from '../lib/format.js'

export default function BuildSummary({ quote, paintLabel, error, buildName, dirty, ordered, busy, notice, onSave, onCart, onShare }) {
  const line = (label, value, key) => (
    <div key={key} className="d-flex justify-content-between gap-3 small text-body-secondary"><span>{label}</span><span>{value}</span></div>
  )
  return (
    <Card>
      <Card.Body className="d-flex flex-column gap-2">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h2 className="h5 mb-0">Build summary</h2>
          {buildName && <Badge bg="secondary" className="fw-normal">{buildName}{dirty ? ' · unsaved changes' : ''}</Badge>}
        </div>
        {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
        {quote && (
          <>
            {line('Base car', money(quote.base))}
            {line(`Paint · ${paintLabel}`, quote.paint ? '+' + money(quote.paint) : 'Included')}
            {quote.lines.map((l) => line(l.name, '+' + money(l.price), l.id))}
            <div className="d-flex justify-content-between border-top pt-2 fs-4 fw-bold"><span>Total</span><span>{money(quote.total)}</span></div>
          </>
        )}
        {ordered && <Alert variant="secondary" className="mb-0 small">This build has been ordered, so changes can't be saved. Duplicate it in My builds to make a new version.</Alert>}
        <Stack direction="horizontal" gap={2}>
          <Button variant="warning" className="flex-fill" onClick={onSave} disabled={busy || !!error || ordered || (buildName && !dirty)}>
            {buildName ? (dirty ? 'Save changes' : 'Saved') : 'Save build'}
          </Button>
          <Button variant="outline-light" onClick={onShare} disabled={busy || !!error}>Share</Button>
        </Stack>
        <Button variant="outline-light" onClick={onCart} disabled={busy || !!error || !quote?.lines.length}>Add to cart</Button>
        <Button variant="outline-secondary" disabled title="Coming later">Generate my build (AI preview, coming later)</Button>
        {notice && <Alert variant="secondary" className="mb-0 small" role="status">{notice}</Alert>}
      </Card.Body>
    </Card>
  )
}
