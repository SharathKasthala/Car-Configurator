import { Button } from 'react-bootstrap'

const money = (n) => (Number(n) ? '+$' + Number(n).toLocaleString('en-US') : 'Included')

export default function PaintPicker({ paints, finishes, paintId, finishId, onPaint, onFinish }) {
  const current = paints.find((p) => p.id === paintId)
  return (
    <div className="d-flex flex-column gap-2">
      <div className="fw-semibold small">Color · <span className="text-body-secondary fw-normal">{current?.name}</span></div>
      <div className="d-flex flex-wrap gap-2">
        {paints.map((p) => (
          <button
            key={p.id}
            className={'swatch' + (p.id === paintId ? ' on' : '')}
            style={{ background: p.hex_color }}
            onClick={() => onPaint(p.id)}
            aria-label={`${p.name} ${money(p.price)}`}
            aria-pressed={p.id === paintId}
            title={`${p.name} · ${money(p.price)}`}
          />
        ))}
      </div>
      <div className="fw-semibold small mt-2">Finish</div>
      <div className="d-flex flex-wrap gap-2">
        {finishes.map((f) => (
          <Button key={f.id} variant={f.id === finishId ? 'warning' : 'outline-secondary'} className="rounded-pill"
                  onClick={() => onFinish(f.id)} aria-pressed={f.id === finishId}>
            {f.name} {Number(f.price) ? `+$${Number(f.price).toLocaleString('en-US')}` : ''}
          </Button>
        ))}
      </div>
    </div>
  )
}
