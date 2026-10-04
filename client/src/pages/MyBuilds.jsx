import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Button, Badge, Form, InputGroup, Alert, Spinner, Stack } from 'react-bootstrap'
import api, { errorText } from '../api/client.js'
import { useCart } from '../context/CartContext.jsx'
import BuildImage from '../components/BuildImage.jsx'
import ItemCard from '../components/ItemCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import CategoryPills from '../components/CategoryPills.jsx'
import Modal, { ModalActions } from '../components/Modal.jsx'
import { money, date } from '../lib/format.js'

export default function MyBuilds() {
  const { addBuild } = useCart()
  const [builds, setBuilds] = useState(null)
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState('recent')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState({})
  const [error, setError] = useState('')

  const load = () => api.get('/builds').then((r) => setBuilds(r.data)).catch((e) => setError(errorText(e)))
  useEffect(() => { load() }, [])

  const flash = (id, text) => {
    setNotice((n) => ({ ...n, [id]: text }))
    setTimeout(() => setNotice((n) => ({ ...n, [id]: '' })), 2500)
  }

  const list = useMemo(() => {
    if (!builds) return []
    const l = builds.filter((b) => tab === 'all' || b.status === tab)
    if (sort === 'high') return [...l].sort((a, b) => b.total - a.total)
    if (sort === 'low') return [...l].sort((a, b) => a.total - b.total)
    return l
  }, [builds, tab, sort])

  const count = (s) => (builds || []).filter((b) => s === 'all' || b.status === s).length

  const rename = async (b) => {
    try {
      const res = await api.put(`/builds/${b.id}`, { name: draft })
      setBuilds((all) => all.map((x) => (x.id === b.id ? res.data : x)))
      setEditing(null)
    } catch (e) { flash(b.id, errorText(e)) }
  }
  const share = async (b) => {
    try {
      const res = await api.post(`/builds/${b.id}/share`)
      try { await navigator.clipboard.writeText(res.data.url); flash(b.id, 'Link copied') } catch { flash(b.id, res.data.url) }
    } catch (e) { flash(b.id, errorText(e)) }
  }
  const duplicate = async (b) => {
    try { await api.post(`/builds/${b.id}/duplicate`); await load() } catch (e) { flash(b.id, errorText(e)) }
  }
  const remove = async () => {
    await api.delete(`/builds/${confirm.id}`)
    setConfirm(null)
    load()
  }
  const toCart = async (b) => {
    try { await addBuild(b.id); flash(b.id, 'Parts added to cart') } catch (e) { flash(b.id, errorText(e)) }
  }

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!builds) return <div className="text-center py-5"><Spinner animation="border" /></div>

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h1 className="mb-1">My builds</h1>
          <p className="lead text-body-secondary mb-0">Your saved cars. Open one to keep editing.</p>
        </div>
        <Button as={Link} to="/catalog" variant="warning">+ New build</Button>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <CategoryPills
          items={[['all', `All (${count('all')})`], ['draft', `Drafts (${count('draft')})`], ['ordered', `Ordered (${count('ordered')})`]]}
          value={tab} onChange={setTab} />
        <InputGroup className="w-auto">
          <InputGroup.Text>Sort</InputGroup.Text>
          <Form.Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort builds">
            <option value="recent">Most recent</option>
            <option value="high">Total: high to low</option>
            <option value="low">Total: low to high</option>
          </Form.Select>
        </InputGroup>
      </div>

      {list.length ? (
        <Row xs={1} md={2} xl={3} className="g-3">
          {list.map((b) => (
            <Col key={b.id}>
              <ItemCard
                art={<BuildImage build={b} />}
                tagLeft={b.status === 'ordered' ? 'Ordered' : 'Draft'} tagLeftVariant={b.status === 'ordered' ? 'success' : 'dark'}
              >
                {editing === b.id ? (
                  <Form onSubmit={(e) => { e.preventDefault(); rename(b) }}>
                    <InputGroup>
                      <Form.Control value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus aria-label="Build name" />
                      <Button type="submit" variant="warning">Save</Button>
                      <Button variant="outline-light" onClick={() => setEditing(null)}>Cancel</Button>
                    </InputGroup>
                  </Form>
                ) : (
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <h3 className="h5 mb-0">{b.name}</h3>
                      <div className="small text-body-secondary">{b.car_name} · Saved {date(b.updated_at)}</div>
                    </div>
                    <Button variant="outline-light" size="sm" aria-label="Rename build" onClick={() => { setEditing(b.id); setDraft(b.name) }}>✎</Button>
                  </div>
                )}
                <div className="d-flex flex-wrap gap-1">
                  <Badge bg="secondary" className="fw-normal">{b.paint_name}{b.finish_name ? `, ${b.finish_name}` : ''}</Badge>
                  {b.parts.slice(0, 4).map((p) => <Badge key={p.id} bg="secondary" className="fw-normal">{p.name}</Badge>)}
                  {b.parts.length > 4 && <Badge bg="secondary" className="fw-normal">+{b.parts.length - 4} more</Badge>}
                </div>
                <div className="d-flex justify-content-between align-items-baseline border-top pt-2 mt-auto">
                  <span className="small text-body-secondary">Build total</span>
                  <strong className="fs-5">{money(b.total)}</strong>
                </div>
                <Stack direction="horizontal" gap={2}>
                  <Button as={Link} to={`/configure/${b.slug}?build=${b.id}`} variant="warning" className="flex-fill">Open build</Button>
                  <Button variant="outline-light" className="flex-fill" disabled={b.status === 'ordered' || !b.parts.length} onClick={() => toCart(b)}>
                    {b.status === 'ordered' ? 'Already ordered' : 'Add parts to cart'}
                  </Button>
                </Stack>
                <Stack direction="horizontal" gap={1} className="flex-wrap">
                  <Button variant="link" size="sm" className="link-warning" onClick={() => share(b)}>Share</Button>
                  <Button variant="link" size="sm" className="link-warning" onClick={() => duplicate(b)}>Duplicate</Button>
                  <Button variant="link" size="sm" className="link-danger" onClick={() => setConfirm(b)}>Delete</Button>
                  {notice[b.id] && <span className="small text-success ms-auto" role="status">{notice[b.id]}</span>}
                </Stack>
              </ItemCard>
            </Col>
          ))}
        </Row>
      ) : (
        <EmptyState
          title={tab === 'ordered' ? 'No ordered builds yet' : tab === 'draft' ? 'No drafts' : 'No saved builds yet'}
          text="Pick a car from the catalog, customize it, and save it here to come back later.">
          <Button as={Link} to="/catalog" variant="warning">Browse cars</Button>
        </EmptyState>
      )}

      {confirm && (
        <Modal title="Delete this build?" onClose={() => setConfirm(null)}>
          <p className="text-body-secondary mb-0">"{confirm.name}" will be removed. This can't be undone.</p>
          <ModalActions>
            <Button variant="outline-light" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>Delete build</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
