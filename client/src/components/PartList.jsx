import { Button, Badge, Stack } from 'react-bootstrap'
import { SINGLE_CHOICE, blockReason } from '../lib/rules.js'

const money = (n) => '$' + Number(n).toLocaleString('en-US')

function specLine(specs = {}) {
  return ['material', 'finish', 'size', 'drop'].map((k) => specs[k]).filter(Boolean).join(' · ')
}

export default function PartList({ category, parts, allParts, rules, selected, onToggle }) {
  const single = SINGLE_CHOICE.includes(category)
  return (
    <Stack gap={2}>
      {parts.map((p) => {
        const on = selected.has(p.id)
        const reason = on ? null : blockReason(p, selected, allParts, rules)
        return (
          <div key={p.id} className={`d-flex align-items-center gap-3 p-2 border rounded-3 bg-body-tertiary${on ? ' border-warning' : ''}`}>
            <div className="part-thumb">
              {p.image_url ? <img src={p.image_url} alt="" /> : 'Photo'}
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-semibold">{p.name}</div>
              <div className="small text-body-secondary">{p.part_brand}{specLine(p.specs) && ` · ${specLine(p.specs)}`}</div>
              <div className="d-flex flex-wrap gap-1 mt-1">
                <Badge bg={p.is_visual ? 'warning' : 'secondary'} text={p.is_visual ? 'dark' : undefined} className="fw-normal">
                  {p.is_visual ? 'In AI preview' : 'Specs only'}
                </Badge>
                {p.stock <= 3 && p.stock > 0 && <Badge bg="secondary" className="fw-normal text-warning">Only {p.stock} left</Badge>}
              </div>
              {reason && <div className="small text-warning mt-1">{reason}</div>}
            </div>
            <div className="d-flex flex-column align-items-end gap-2 flex-shrink-0">
              <strong>{money(p.price)}</strong>
              <Button size="sm" variant={on ? 'warning' : 'outline-light'} disabled={!!reason || p.stock === 0}
                      onClick={() => onToggle(p.id)} style={{ minWidth: 80 }}>
                {p.stock === 0 ? 'Sold out' : on ? (single ? 'Selected' : 'Added') : (single ? 'Select' : 'Add')}
              </Button>
            </div>
          </div>
        )
      })}
    </Stack>
  )
}
