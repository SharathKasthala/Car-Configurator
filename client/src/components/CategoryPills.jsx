import { Button } from 'react-bootstrap'

// Reusable row of pill buttons (categories, tabs, status filters)
export default function CategoryPills({ items, value, onChange, children }) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {items.map((it) => {
        const [id, label] = Array.isArray(it) ? it : [it, it]
        return (
          <Button key={id} variant={id === value ? 'warning' : 'outline-secondary'} className="rounded-pill" onClick={() => onChange(id)}>
            {label}
          </Button>
        )
      })}
      {children}
    </div>
  )
}
