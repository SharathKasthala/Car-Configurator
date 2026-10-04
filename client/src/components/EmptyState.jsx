import { Card } from 'react-bootstrap'

// Reusable "nothing here" box
export default function EmptyState({ title, text, children }) {
  return (
    <Card body className="text-center py-4">
      <h2 className="h5">{title}</h2>
      {text && <p className="text-body-secondary">{text}</p>}
      {children}
    </Card>
  )
}
