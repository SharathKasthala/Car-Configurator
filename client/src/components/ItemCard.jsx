import { Card, Badge } from 'react-bootstrap'

// Reusable card used by the catalog, marketplace and My builds.
// art: picture area, tagLeft / tagRight: small labels over the picture.
export default function ItemCard({ art, tagLeft, tagLeftVariant = 'dark', tagRight, tagRightVariant = 'dark', dim, selected, children }) {
  const label = (text, variant, side) => text && (
    <Badge bg={variant} text={variant === 'warning' ? 'dark' : undefined}
           className={`position-absolute top-0 ${side}-0 m-2 fw-normal`}>{text}</Badge>
  )
  return (
    <Card className={`h-100${selected ? ' border-warning' : ''}${dim ? ' opacity-50' : ''}`}>
      <div className="position-relative bg-body-secondary rounded-top overflow-hidden">
        {art}
        {label(tagLeft, tagLeftVariant, 'start')}
        {label(tagRight, tagRightVariant, 'end')}
      </div>
      <Card.Body className="d-flex flex-column gap-2">{children}</Card.Body>
    </Card>
  )
}
